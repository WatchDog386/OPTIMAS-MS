#!/bin/sh
# Database + photo backups. Runs inside the `backup` container.
#   sh /backup.sh once   → take one backup now
#   sh /backup.sh loop   → take a backup every day at BACKUP_HOUR (server time), keep BACKUP_KEEP_DAYS days
set -eu

backup_once() {
  stamp=$(date +%Y-%m-%d_%H%M)
  mkdir -p /backups
  echo "[backup] $stamp: dumping database…"
  pg_dump --format=custom --no-owner --file="/backups/db_$stamp.dump"
  echo "[backup] $stamp: archiving photos…"
  tar -czf "/backups/photos_$stamp.tar.gz" -C /uploads .
  find /backups -type f \( -name 'db_*.dump' -o -name 'photos_*.tar.gz' \) -mtime +"${BACKUP_KEEP_DAYS:-14}" -delete
  echo "[backup] $stamp: done"
}

case "${1:-once}" in
  once) backup_once ;;
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
