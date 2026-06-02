#!/bin/bash
# Smoke test: verify Postgres migrations + seed work end-to-end
# Run after: docker compose up -d db && docker compose up app

set -e

# Wait for Postgres to be healthy
echo "→ Waiting for Postgres..."
for i in {1..30}; do
  if docker exec bettercal-db-1 pg_isready -U postgres -d bettercal &>/dev/null; then
    echo "✓ Postgres healthy"
    break
  fi
  sleep 2
done

# Run migrations
echo "→ Applying migrations..."
docker compose exec -T app npm run db:migrate

# Run seed
echo "→ Seeding demo host..."
docker compose exec -T app npm run db:seed

# Verify demo user exists
echo "→ Verifying demo user..."
DEMO_USER=$(docker exec bettercal-db-1 psql -U postgres -d bettercal -t -c "SELECT COUNT(*) FROM users WHERE username='demo'")
if [ "$DEMO_USER" -eq 1 ]; then
  echo "✓ Demo user created"
else
  echo "✗ Demo user not found"
  exit 1
fi

# Verify event type exists
echo "→ Verifying event type..."
EVENT_TYPES=$(docker exec bettercal-db-1 psql -U postgres -d bettercal -t -c "SELECT COUNT(*) FROM event_types WHERE slug='intro'")
if [ "$EVENT_TYPES" -eq 1 ]; then
  echo "✓ Event type 'intro' created"
else
  echo "✗ Event type not found"
  exit 1
fi

# Verify app is running
echo "→ Checking app health..."
if curl -f http://localhost:3000/demo/intro &>/dev/null; then
  echo "✓ App responding at /demo/intro"
else
  echo "✗ App not responding"
  exit 1
fi

echo ""
echo "=== All smoke tests passed ==="
echo "→ Open http://localhost:3000/demo/intro in a browser"
