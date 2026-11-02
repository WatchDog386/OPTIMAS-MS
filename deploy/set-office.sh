#!/usr/bin/env bash
# Sets the office location used to check that staff check in at the office.
#
#   cd ~/OPTIMAS-MS && bash deploy/set-office.sh "https://maps.app.goo.gl/xxxx"
#   cd ~/OPTIMAS-MS && bash deploy/set-office.sh "-1.2921,36.8219"
#
# Give it a Google Maps share link (from "Share" on the office pin) or the coordinates. It finds the
# office's latitude and longitude, saves them in deploy/.env (OFFICE_LAT / OFFICE_LNG) and restarts the
# app so check-ins more than OFFICE_RADIUS_M metres (300 by default) from the office are flagged.
set -euo pipefail
cd "$(dirname "$0")/.."

INPUT="${1:?Usage: bash deploy/set-office.sh \"<Google Maps link or lat,lng>\"}"
COMPOSE="docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env"

if [[ "$INPUT" =~ ^[[:space:]]*(-?[0-9]+\.[0-9]+)[[:space:]]*,[[:space:]]*(-?[0-9]+\.[0-9]+)[[:space:]]*$ ]]; then
  LAT="${BASH_REMATCH[1]}"
  LNG="${BASH_REMATCH[2]}"
else
  echo "Opening the map link…"
  # Follow the short link to the full Google Maps address; the page itself is read too in case the
  # coordinates are only in its content
  FINAL="$(curl -sL --max-time 25 -o /tmp/optimas-office.html -w '%{url_effective}' -A 'Mozilla/5.0' "$INPUT")" || { echo "Could not open the link. Check the server has internet, or give the coordinates instead."; exit 1; }
  read -r LAT LNG < <(python3 - "$FINAL" /tmp/optimas-office.html <<'PY'
import re, sys, urllib.parse
url = urllib.parse.unquote(urllib.parse.unquote(sys.argv[1]))
try:
    page = urllib.parse.unquote(open(sys.argv[2], encoding="utf-8", errors="ignore").read())
except OSError:
    page = ""
def ok(a, b):
    a, b = float(a), float(b)
    return -90 <= a <= 90 and -180 <= b <= 180 and (a, b) != (0, 0)
# Best first: the pin itself (!3d…!4d…), then a search/centre (q=, ll=, @lat,lng), in the address then the page
patterns = [r"!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)", r"/(?:search|place|dir)/(-?\d+\.\d+),\s*\+?(-?\d+\.\d+)", r"[?&](?:q|ll|query|destination)=(-?\d+\.\d+),\s*(-?\d+\.\d+)", r"@(-?\d+\.\d+),(-?\d+\.\d+)"]
for text in (url, page):
    for p in patterns:
        for m in re.finditer(p, text):
            if ok(*m.groups()):
                print(m.group(1), m.group(2)); sys.exit(0)
print("", "")
PY
)
  rm -f /tmp/optimas-office.html
  if [ -z "${LAT:-}" ] || [ -z "${LNG:-}" ]; then
    echo "Could not find coordinates in that link."
    echo "In Google Maps, press and hold on the office until a red pin appears; the numbers like"
    echo "-1.2921, 36.8219 at the top are the coordinates. Run: bash deploy/set-office.sh \"-1.2921,36.8219\""
    exit 1
  fi
fi

echo "Office location: $LAT, $LNG"
echo "Check it on the map: https://www.google.com/maps?q=$LAT,$LNG"

touch deploy/.env
for KEY in OFFICE_LAT OFFICE_LNG; do
  VAL=$([ "$KEY" = OFFICE_LAT ] && echo "$LAT" || echo "$LNG")
  if grep -q "^$KEY=" deploy/.env; then
    sed -i "s/^$KEY=.*/$KEY=$VAL/" deploy/.env
  else
    printf '%s=%s\n' "$KEY" "$VAL" >> deploy/.env
  fi
done
echo "Saved in deploy/.env."

if docker ps >/dev/null 2>&1 && $COMPOSE ps --services 2>/dev/null | grep -qx api; then
  $COMPOSE up -d api >/dev/null
  echo "App restarted: check-ins away from the office are now flagged."
else
  echo "Start (or redeploy) the app for it to take effect: bash deploy/deploy.sh"
fi
