#!/usr/bin/env bash
# Build and (re)start Optimas MS. Safe to run repeatedly — use it for every update.
#   bash deploy/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f deploy/.env ]; then
  echo "deploy/.env not found. Copy deploy/.env.example to deploy/.env and fill it in first." >&2
  exit 1
fi
if grep -q "CHANGE_ME" deploy/.env; then
  echo "deploy/.env still contains CHANGE_ME values. Set POSTGRES_PASSWORD and JWT_SECRET." >&2
  exit 1
fi

COMPOSE="docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env"

if [ -d .git ]; then
  echo "▶ Pulling latest code…"
  git pull --ff-only
fi

echo "▶ Building images…"
$COMPOSE build

echo "▶ Starting services (database migrations run automatically)…"
$COMPOSE up -d --remove-orphans

echo "▶ Waiting for the API to become healthy…"
for i in $(seq 1 30); do
  if $COMPOSE exec -T api wget -qO- http://127.0.0.1:4000/health >/dev/null 2>&1; then
    echo "✅ Optimas MS is up."
    $COMPOSE ps
    exit 0
  fi
  sleep 3
done
echo "❌ API did not become healthy. Recent logs:" >&2
$COMPOSE logs --tail=80 api >&2
exit 1
