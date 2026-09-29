# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci --no-audit --no-fund

FROM node:22-bookworm-slim AS runtime-dependencies
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci --omit=dev --no-audit --no-fund

FROM node:22-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 \
    NODE_OPTIONS=--max-old-space-size=1536
ARG RELEASE_SOURCE_ORIGIN=https://tingye-reader.vercel.app
COPY --from=dependencies /app/node_modules ./node_modules
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p public/releases \
    && curl --fail --location --retry 3 \
      "${RELEASE_SOURCE_ORIGIN}/releases/wereader-1.8.0-18001.apk" \
      --output public/releases/wereader-1.8.0-18001.apk \
    && echo "f9283eb4b2ff822923fd16b9d215fded8eab82f408a927b92608ec5baf5b3241  public/releases/wereader-1.8.0-18001.apk" | sha256sum --check \
    && curl --fail --location --retry 3 \
      "${RELEASE_SOURCE_ORIGIN}/releases/tingye-ios-1.8.0-build37.ipa" \
      --output public/releases/tingye-ios-1.8.0-build37.ipa \
    && echo "19007183eceda7876c2bddf18b4e527cac2a08103daacdbbf266cd9b8282eae2  public/releases/tingye-ios-1.8.0-build37.ipa" | sha256sum --check
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=5174
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=runtime-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/db ./db
COPY --from=builder --chown=node:node /app/scripts/migrate.mjs ./scripts/migrate.mjs
COPY --from=builder --chown=node:node /app/scripts/start-production.mjs ./scripts/start-production.mjs
USER node
EXPOSE 5174
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:5174/login').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "scripts/start-production.mjs"]
