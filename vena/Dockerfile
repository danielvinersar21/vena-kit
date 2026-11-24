# Supervisor >= 2026.04 nu mai trimite BUILD_FROM implicit; build.yaml e deprecated.
ARG BUILD_FROM=ghcr.io/home-assistant/base:3.24

FROM ghcr.io/home-assistant/base:3.24 AS deps
RUN apk add --no-cache nodejs npm
WORKDIR /app
COPY app/package.json app/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

FROM ${BUILD_FROM}
RUN apk add --no-cache nodejs
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY app/package.json ./
COPY app/server ./server
COPY app/ui/dist ./ui/dist
ENV NODE_ENV=production
LABEL io.hass.type="app" io.hass.name="Vena"
# S6 resetează mediul pentru CMD; with-contenv readuce SUPERVISOR_TOKEN.
CMD ["/command/with-contenv", "node", "--max-old-space-size=48", "server/index.js"]
