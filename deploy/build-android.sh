#!/usr/bin/env bash
# Build the Optimas MS Android app (release APK) on this server and publish it at
#   https://<your site>/downloads/optimas-ms.apk
# Installed apps read /downloads/android.json and offer the update in-app.
#
#   sudo bash deploy/build-android.sh
#
# First run downloads the Android toolchain (~2–3 GB, cached) and takes 15–30 minutes; later runs are faster.
# Signing: put the keystore at deploy/secrets/optimas-release.keystore and set ANDROID_KEYSTORE_PASSWORD,
# ANDROID_KEY_ALIAS and ANDROID_KEY_PASSWORD in deploy/.env. Without them the template key is used.
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT=$(pwd)

[ -f deploy/.env ] && set -a && . deploy/.env && set +a
SITE=${SITE_ADDRESS:-}
case "$SITE" in ""|:*) API_URL=${ANDROID_API_URL:-} ;; *) API_URL=${ANDROID_API_URL:-https://$SITE/api/v1} ;; esac
if [ -z "$API_URL" ]; then
  echo "Set SITE_ADDRESS (your domain) or ANDROID_API_URL in deploy/.env — the app needs the server's https address." >&2
  exit 1
fi

# Minutes since 1970: always increases, fits Android's versionCode, and matches the GitHub Actions build.
VERSION_CODE=$(( $(date +%s) / 60 ))
KEYSTORE_B64=""
if [ -f deploy/secrets/optimas-release.keystore ]; then KEYSTORE_B64=$(base64 -w0 deploy/secrets/optimas-release.keystore); fi

echo "▶ Building the Android toolchain image (cached after the first run)…"
docker build -q -t optimas-android-builder -f deploy/android.Dockerfile deploy >/dev/null

echo "▶ Building the APK (versionCode $VERSION_CODE, API $API_URL)…"
mkdir -p deploy/downloads
docker run --rm \
  -v "$ROOT/mobile":/src:ro \
  -v optimas-gradle-cache:/root/.gradle \
  -v optimas-android-sdk:/opt/android-sdk \
  -v optimas-npm-cache:/root/.npm \
  -v "$ROOT/deploy/downloads":/out \
  -e EXPO_PUBLIC_API_URL="$API_URL" \
  -e ANDROID_VERSION_CODE="$VERSION_CODE" \
  -e ANDROID_KEYSTORE_BASE64="$KEYSTORE_B64" \
  -e ANDROID_KEYSTORE_PASSWORD="${ANDROID_KEYSTORE_PASSWORD:-}" \
  -e ANDROID_KEY_ALIAS="${ANDROID_KEY_ALIAS:-}" \
  -e ANDROID_KEY_PASSWORD="${ANDROID_KEY_PASSWORD:-}" \
  -e EXPO_NO_TELEMETRY=1 -e CI=1 \
  -e GRADLE_OPTS="-Dorg.gradle.jvmargs=-Xmx3g -Dorg.gradle.workers.max=2" \
  optimas-android-builder bash -euo pipefail -c '
    # Work on a copy so the build never writes into the repository
    rm -rf /work/app && mkdir -p /work/app && cp -a /src/. /work/app/ && cd /work/app
    rm -rf node_modules android
    npm ci --no-audit --no-fund
    npx expo prebuild --platform android --no-install --clean
    node scripts/android-signing.mjs
    cd android
    ./gradlew assembleRelease --no-daemon -PreactNativeArchitectures=arm64-v8a,armeabi-v7a
    cp app/build/outputs/apk/release/app-release.apk /out/optimas-ms.apk.tmp
    mv /out/optimas-ms.apk.tmp /out/optimas-ms.apk
  '

printf '{"versionCode":%s,"url":"/downloads/optimas-ms.apk","builtAt":"%s"}\n' "$VERSION_CODE" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > deploy/downloads/android.json
echo "✅ APK ready: deploy/downloads/optimas-ms.apk ($(du -h deploy/downloads/optimas-ms.apk | cut -f1))"
echo "   Download on a phone: ${API_URL%/api/v1}/downloads/optimas-ms.apk"
