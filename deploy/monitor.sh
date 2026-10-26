#!/usr/bin/env bash
# Watches Optimas MS and tells you when something is wrong (and when it is fixed again).
#   bash deploy/monitor.sh            run the checks once (prints a summary; alerts if ALERT_URL is set)
#   bash deploy/monitor.sh --install  run it every 5 minutes from cron
#
# Settings go in deploy/monitor.env (see monitor.env.example). It checks:
#   - the site answers and the database is reachable (/health)
#   - the disk is not nearly full
#   - a database backup was made recently (and, if configured, copied off-site)
# An alert is sent when a check starts failing and again when it recovers, not on every run.
set -uo pipefail
cd "$(dirname "$0")/.."

[ -f deploy/monitor.env ] && . deploy/monitor.env

if [ "${1:-}" = "--install" ]; then
  line="*/5 * * * * cd $(pwd) && bash deploy/monitor.sh >/dev/null 2>&1"
  ( crontab -l 2>/dev/null | grep -vF "deploy/monitor.sh" ; echo "$line" ) | crontab -
  echo "✅ Installed: the checks now run every 5 minutes."
  exit 0
fi

SITE_URL="${SITE_URL:-http://127.0.0.1/health}"
ALERT_URL="${ALERT_URL:-}"
ALERT_FORMAT="${ALERT_FORMAT:-ntfy}"   # ntfy (plain text, e.g. https://ntfy.sh/your-topic) or json ({"text": "..."} for Slack/Mattermost)
NAME="${MONITOR_NAME:-Optimas MS}"
DISK_PATH="${DISK_PATH:-/}"
DISK_WARN_PCT="${DISK_WARN_PCT:-85}"
BACKUPS_DIR="${BACKUPS_DIR:-deploy/backups}"
BACKUP_MAX_AGE_H="${BACKUP_MAX_AGE_H:-30}"
STATE="${MONITOR_STATE:-deploy/.monitor-state}"

problems=()   # "key|message"

# 1. Site and database
body=$(curl -fsS -m 10 "$SITE_URL" 2>&1) || body=""
if [ -z "$body" ] || ! printf '%s' "$body" | grep -q '"status":"ok"'; then
  problems+=("site|The site is not answering properly at $SITE_URL")
fi

# 2. Disk
used=$(df -P "$DISK_PATH" 2>/dev/null | awk 'NR==2 {gsub("%","",$5); print $5}')
if [ -n "${used:-}" ] && [ "$used" -ge "$DISK_WARN_PCT" ]; then
  problems+=("disk|The disk is ${used}% full (limit ${DISK_WARN_PCT}%)")
fi

# 3. Backups
newest=$(ls -t "$BACKUPS_DIR"/db_*.dump 2>/dev/null | head -1 || true)
if [ -z "$newest" ]; then
  problems+=("backup|No database backup found in $BACKUPS_DIR")
else
  age_h=$(( ( $(date +%s) - $(stat -c %Y "$newest") ) / 3600 ))
  [ "$age_h" -gt "$BACKUP_MAX_AGE_H" ] && problems+=("backup|The newest database backup is ${age_h} hours old")
fi
if [ -f "$BACKUPS_DIR/.offsite_ok" ]; then
  off_h=$(( ( $(date +%s) - $(cat "$BACKUPS_DIR/.offsite_ok") ) / 3600 ))
  [ "$off_h" -gt "$BACKUP_MAX_AGE_H" ] && problems+=("offsite|The last off-site backup copy was ${off_h} hours ago")
fi

alert() {
  echo "$1"
  [ -n "$ALERT_URL" ] || return 0
  if [ "$ALERT_FORMAT" = "json" ]; then
    curl -fsS -m 10 -H 'Content-Type: application/json' -d "{\"text\": \"$NAME: $1\"}" "$ALERT_URL" >/dev/null 2>&1 || true
  else
    curl -fsS -m 10 -H "Title: $NAME" -d "$1" "$ALERT_URL" >/dev/null 2>&1 || true
  fi
}

# Compare with the last run: speak only about changes
touch "$STATE"
now_keys=$(printf '%s\n' "${problems[@]:-}" | cut -d'|' -f1 | sort -u | grep -v '^$' || true)
for p in "${problems[@]:-}"; do
  [ -z "$p" ] && continue
  key=${p%%|*}; msg=${p#*|}
  grep -qx "$key" "$STATE" || alert "⚠️ $msg"
done
while read -r key; do
  [ -z "$key" ] && continue
  printf '%s\n' "$now_keys" | grep -qx "$key" || alert "✅ Recovered: $key is fine again"
done < "$STATE"
printf '%s\n' "$now_keys" > "$STATE"

if [ "${#problems[@]}" -eq 0 ]; then
  echo "OK: site up, disk ${used:-?}% used, newest backup ${age_h:-?}h old"
  exit 0
fi
exit 1
