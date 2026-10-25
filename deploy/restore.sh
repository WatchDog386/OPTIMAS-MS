#!/usr/bin/env bash
# Restore a database dump (and optionally photos) produced by backup.sh.
#   bash deploy/restore.sh deploy/backups/db_2026-10-25_0100.dump [deploy/backups/photos_2026-10-25_0100.tar.gz]
set -euo pipefail
cd "$(dirname "$0")/.."
DB_DUMP=${1:?usage: restore.sh <db_dump> [photos_tar]}
PHOTOS=${2:-}
COMPOSE="docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env"

read -r -p "This REPLACES the current database. Type RESTORE to continue: " answer
[ "$answer" = "RESTORE" ] || { echo "Aborted."; exit 1; }

$COMPOSE stop api
$COMPOSE exec -T db sh -c 'dropdb -U "$POSTGRES_USER" --if-exists "$POSTGRES_DB" && createdb -U "$POSTGRES_USER" "$POSTGRES_DB"'
$COMPOSE exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner' < "$DB_DUMP"
if [ -n "$PHOTOS" ]; then
  $COMPOSE run --rm -T --no-deps --entrypoint sh -v "$(realpath "$PHOTOS")":/restore.tar.gz:ro api -c 'tar -xzf /restore.tar.gz -C /app/uploads'
fi
$COMPOSE start api
echo "✅ Restore complete."
