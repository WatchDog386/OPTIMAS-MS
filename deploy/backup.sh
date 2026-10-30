#!/bin/sh
# Database + photo backups. Runs inside the `backup` container.
#   sh /backup.sh once   → take one backup now
#   sh /backup.sh loop   → take a backup every day at BACKUP_HOUR (server time), keep BACKUP_KEEP_DAYS days
#
# Off-site copy (so a dead server does not take the backups with it): set BACKUP_REMOTE to an rclone
# destination, e.g. "offsite:optimas-backups", and describe it with RCLONE_CONFIG_* variables in
# deploy/backup.env (see backup.env.example). Without BACKUP_REMOTE only the local copy is kept.
set -eu

DEST="${BACKUP_PATH:-/backups}"
SRC="${UPLOADS_PATH:-/uploads}"

# With BACKUP_PASSPHRASE set, files are encrypted on this server before upload (rclone "crypt"):
# the storage company only ever holds scrambled data. Keep the passphrase somewhere safe: without it
# the off-site copies cannot be read, by anyone.
# Sets TARGET (and, when encrypting, the "sealed" remote's settings in this shell)
target() {
  if [ -n "${BACKUP_PASSPHRASE:-}" ]; then
    export RCLONE_CONFIG_SEALED_TYPE=crypt
    export RCLONE_CONFIG_SEALED_REMOTE="$BACKUP_REMOTE"
    RCLONE_CONFIG_SEALED_PASSWORD=$(rclone obscure "$BACKUP_PASSPHRASE")
    export RCLONE_CONFIG_SEALED_PASSWORD
    TARGET="sealed:"
  else
    TARGET="$BACKUP_REMOTE"
  fi
}

offsite() {
  stamp="$1"
  [ -n "${BACKUP_REMOTE:-}" ] || return 0
  command -v rclone >/dev/null 2>&1 || apk add --no-cache rclone >/dev/null 2>&1 || { echo "[backup] OFFSITE FAILED: rclone is not available"; return 1; }
  target
  to="$TARGET"
  [ -n "${BACKUP_PASSPHRASE:-}" ] && echo "[backup] $stamp: encrypting and copying off-site to $BACKUP_REMOTE…" || echo "[backup] $stamp: copying off-site to $BACKUP_REMOTE (not encrypted: set BACKUP_PASSPHRASE)…"
  rclone copy "$DEST" "$to" --include "*_$stamp.*" || { echo "[backup] OFFSITE FAILED: could not upload"; return 1; }
  rclone delete "$to" --min-age "${BACKUP_REMOTE_KEEP_DAYS:-60}d" >/dev/null 2>&1 || true
  date +%s > "$DEST/.offsite_ok"
  echo "[backup] $stamp: off-site copy done"
}

backup_once() {
  stamp=$(date +%Y-%m-%d_%H%M)
  mkdir -p "$DEST"
  echo "[backup] $stamp: dumping database…"
  pg_dump --format=custom --no-owner --file="$DEST/db_$stamp.dump"
  echo "[backup] $stamp: archiving photos…"
  tar -czf "$DEST/photos_$stamp.tar.gz" -C "$SRC" .
  find "$DEST" -type f \( -name 'db_*.dump' -o -name 'photos_*.tar.gz' \) -mtime +"${BACKUP_KEEP_DAYS:-14}" -delete
  offsite "$stamp" || true
  echo "[backup] $stamp: done"
}

# Bring an off-site copy back (decrypting it): sh /backup.sh fetch db_2026-10-25_0100.dump
fetch() {
  [ -n "${BACKUP_REMOTE:-}" ] || { echo "BACKUP_REMOTE is not set"; return 1; }
  command -v rclone >/dev/null 2>&1 || apk add --no-cache rclone >/dev/null 2>&1
  target
  rclone copy "$TARGET" "$DEST" --include "$1" && echo "[backup] fetched $1 into $DEST"
}

case "${1:-once}" in
  once) backup_once ;;
  fetch) fetch "${2:?usage: backup.sh fetch <file name>}" ;;
  loop)
    last=""
    while true; do
      today=$(date +%Y-%m-%d)
      hour=$(date +%H | sed 's/^0//')
      if [ "$hour" -ge "${BACKUP_HOUR:-1}" ] && [ "$last" != "$today" ]; then
        backup_once || echo "[backup] FAILED"
        last="$today"
      fi
      sleep 300
    done
    ;;
esac
