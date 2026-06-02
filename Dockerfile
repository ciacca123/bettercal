# syntax=docker/dockerfile:1
# Multi-stage build. Build OFF the NAS (the Cortex-A53 is too slow) and target
# arm64 via buildx:  docker buildx build --platform linux/arm64 -t bettercal:latest .

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S app && adduser -S app -G app

# Next.js standalone server output (minimal runtime deps).
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Migration + seed assets
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src/db ./src/db
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder /app/package.json ./package.json

# Entrypoint inline (avoids CRLF/path issues on Windows build hosts)
RUN printf '#!/bin/sh\nset -e\necho "→ Applying migrations..."\nnode_modules/.bin/tsx src/db/migrate.ts\nif [ "$SEED_DEMO" = "true" ]; then\n  echo "→ Seeding demo host..."\n  node_modules/.bin/tsx src/db/seed.ts\nfi\necho "→ Starting server"\nexec node server.js\n' > /app/docker-entrypoint.sh \
    && chmod +x /app/docker-entrypoint.sh

USER app
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
ENTRYPOINT ["/app/docker-entrypoint.sh"]
