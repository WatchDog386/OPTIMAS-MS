# Builds the Expo app for the web (manager console) and packages it with Caddy.
FROM node:22-alpine AS web
WORKDIR /app
COPY mobile/package*.json ./
RUN npm ci
COPY mobile ./
# Same-origin API: Caddy proxies /api to the backend container.
ENV EXPO_PUBLIC_API_URL=/api/v1 EXPO_OFFLINE=1 CI=1
RUN npx expo export -p web --output-dir /web

FROM caddy:2-alpine
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=web /web /srv/web
