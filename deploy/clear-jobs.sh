#!/usr/bin/env bash
# Removes EVERY job (task) from the live database, for example the demo jobs shown to users.
#
#   cd ~/OPTIMAS-MS && bash deploy/clear-jobs.sh
#
# What it does:
#   1. Saves a full database backup first (deploy/backups/before-clear-jobs-<time>.dump).
#   2. Shows how many jobs there are and asks you to type DELETE ALL JOBS to go on.
#   3. Deletes all jobs and their materials lists, and the job alerts in people's notifications.
#
# What it keeps: people, teams, chats, attendance, the store and every device. Devices and stock
# movements that pointed at a deleted job stay where they are, just without the job link. Customer
# requests that had become a job are closed. The audit log is kept as it is.
#
# To undo: restore the backup it printed, with deploy/restore.sh.
set -euo pipefail
cd "$(dirname "$0")/.."

COMPOSE="docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env"
# Runs psql inside the database container, as the app's own database user
psql() { $COMPOSE exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" "$@"' psql "$@"; }

COUNT="$(psql -tAc 'SELECT count(*) FROM "Task"')"
if [ "$COUNT" = "0" ]; then
  echo "There are no jobs to remove."
  exit 0
fi

echo
echo "There are $COUNT job(s) in the database:"
psql -c 'SELECT code, status, title, "customerName" FROM "Task" ORDER BY "createdAt" DESC LIMIT 15'
[ "$COUNT" -gt 15 ] && echo "  …and $((COUNT - 15)) more"
echo

mkdir -p deploy/backups
BACKUP="deploy/backups/before-clear-jobs-$(date +%Y%m%d-%H%M%S).dump"
echo "Saving a backup first: $BACKUP"
$COMPOSE exec -T db sh -c 'pg_dump -Fc -U "$POSTGRES_USER" -d "$POSTGRES_DB"' > "$BACKUP"
[ -s "$BACKUP" ] || { echo "The backup failed, so nothing was deleted."; exit 1; }
echo "Backup saved."
echo

read -r -p "Type DELETE ALL JOBS to remove all $COUNT job(s), or anything else to stop: " ANSWER
if [ "$ANSWER" != "DELETE ALL JOBS" ]; then
  echo "Stopped. Nothing was deleted."
  exit 0
fi

psql <<'SQL'
BEGIN;
-- Requests that had become a job: closed, so they do not sit as "scheduled" with no job
UPDATE "ServiceRequest" SET status = 'CLOSED' WHERE id IN (SELECT "requestId" FROM "Task" WHERE "requestId" IS NOT NULL);
-- Job alerts in everyone's notification list
DELETE FROM "Notification" WHERE data ? 'taskId';
-- Unused photo challenges for those jobs
DELETE FROM "CaptureChallenge" WHERE "taskId" IS NOT NULL;
-- The jobs (their materials lists go with them; devices and stock movements keep their place)
DELETE FROM "Task";
COMMIT;
SQL

echo
echo "Done: all jobs removed. Refresh the app to see an empty Jobs list."
echo "If you need them back: bash deploy/restore.sh $BACKUP"
