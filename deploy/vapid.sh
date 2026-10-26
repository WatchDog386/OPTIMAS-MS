#!/usr/bin/env bash
# One-time: creates the key pair that lets the web app receive push notifications when it is closed.
#   bash deploy/vapid.sh
# Safe to run again: it never replaces keys that already exist (that would drop everyone's subscriptions).
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f deploy/.env ] || { echo "deploy/.env not found." >&2; exit 1; }
if grep -q '^VAPID_PUBLIC_KEY=.\+' deploy/.env; then
  echo "Web push keys already exist in deploy/.env. Nothing to do."
  exit 0
fi
COMPOSE="docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env"
keys=$($COMPOSE run --rm --no-deps -T api node -e "const k=require('web-push').generateVAPIDKeys();console.log(k.publicKey+' '+k.privateKey)" | tail -1)
pub=${keys%% *}; priv=${keys##* }
[ -n "$pub" ] && [ -n "$priv" ] || { echo "Could not create the keys. Run: bash deploy/deploy.sh first." >&2; exit 1; }
{
  echo ""
  echo "# Web push notifications (created by deploy/vapid.sh). Do not change or share the private key."
  echo "VAPID_PUBLIC_KEY=$pub"
  echo "VAPID_PRIVATE_KEY=$priv"
  echo "VAPID_SUBJECT=mailto:${VAPID_EMAIL:-admin@example.com}"
} >> deploy/.env
echo "✅ Keys saved. Now run: bash deploy/deploy.sh"
