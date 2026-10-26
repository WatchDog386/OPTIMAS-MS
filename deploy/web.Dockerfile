# Builds the Expo app for the web (manager console) and packages it with Caddy.
FROM node:22-alpine AS web
WORKDIR /app
COPY mobile/package*.json ./
RUN npm ci
COPY mobile ./
# Same-origin API: Caddy proxies /api to the backend container.
ENV EXPO_PUBLIC_API_URL=/api/v1 EXPO_OFFLINE=1 CI=1
# Every build gets an id, baked into the bundle and published as /version.json, so installed apps can
# tell when a newer version is live and offer a one-tap update.
RUN BUILD_ID=$(date -u +%Y%m%d%H%M%S) \
 && EXPO_PUBLIC_BUILD_ID=$BUILD_ID npx expo export -p web --output-dir /web \
 && printf '{"build":"%s"}' "$BUILD_ID" > /web/version.json

FROM caddy:2-alpine
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=web /web /srv/web
