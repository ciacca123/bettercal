#!/bin/sh
set -e

echo "→ Applying database migrations..."
node_modules/.bin/tsx src/db/migrate.ts

if [ "$SEED_DEMO" = "true" ]; then
  echo "→ Seeding demo host..."
  node_modules/.bin/tsx src/db/seed.ts
fi

echo "→ Starting server on ${HOSTNAME:-0.0.0.0}:${PORT:-3000}"
exec node server.js
