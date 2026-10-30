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

# The key that signs the QR labels stuck on devices. Made once, here, and never changed: changing it
# would make every printed label read as fake. It is kept only in deploy/.env (back that file up).
if ! grep -q "^ASSET_TAG_SECRET=." deploy/.env; then
  echo "▶ Creating the device-label signing key (once)…"
  KEY="$(openssl rand -hex 32)"
  if grep -q "^ASSET_TAG_SECRET=" deploy/.env; then
    sed -i "s/^ASSET_TAG_SECRET=.*/ASSET_TAG_SECRET=$KEY/" deploy/.env
  else
    printf '\n# Signs the QR labels on devices. Never change it once labels are printed.\nASSET_TAG_SECRET=%s\n' "$KEY" >> deploy/.env
  fi
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
