# Setup & Testing

## Prerequisites

- Node.js 20+
- Docker + Docker Compose (for Postgres testing)
- npm

## Local Development (SQLite)

The local-mock build uses SQLite for instant testing without Docker:

```bash
npm install
npm run setup          # Migrations + demo seed
npm run dev           # http://localhost:3000

# In another terminal, watch tests
npm run test:watch
```

The demo host is at http://localhost:3000/demo/intro.

## Production Build (Postgres)

### 1. Build the Docker Image

```bash
# For your current architecture (amd64 on most dev machines):
docker build -t bettercal:latest .

# For Synology DS218+ (ARM64), build off-device:
docker buildx build --platform linux/arm64 -t bettercal:arm64 .
docker save bettercal:arm64 | gzip > bettercal-arm64.tar.gz
# Transfer to NAS...
```

### 2. Start the Stack Locally (Test)

```bash
# Ensure Docker is running
docker compose up -d

# Wait ~10 seconds for Postgres to initialize
sleep 10

# Verify services are healthy
docker compose ps

# Check app logs for migrations/seed
docker compose logs app

# Test
open http://localhost:3000/demo/intro

# Tail live logs
docker compose logs -f app
```

### 3. Database Testing

```bash
# Connect to Postgres shell
docker exec -it bettercal-db-1 psql -U postgres -d bettercal

# Sample queries
SELECT * FROM users;
SELECT * FROM event_types;
SELECT * FROM bookings;

# Exit
\q
```

### 4. Stop the Stack

```bash
docker compose down           # Containers stop, volumes persist
docker compose down -v        # Also delete the database
```

## Manual Postgres Testing (Advanced)

If you want to test migrations + seed without Docker Compose:

```bash
# 1. Start just the Postgres service
docker compose up -d db

# 2. Wait for health
docker exec bettercal-db-1 pg_isready -U postgres

# 3. Run migrations locally
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/bettercal" npm run db:migrate

# 4. Seed the demo host
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/bettercal" npm run db:seed

# 5. Query to verify
docker exec bettercal-db-1 psql -U postgres -d bettercal -c "SELECT * FROM users WHERE username='demo';"
```

## Deployment to Synology DS218+

See **PRODUCTION.md** for detailed ARM64 build, transfer, and deployment steps.

TL;DR:
```bash
docker buildx build --platform linux/arm64 -t bettercal:latest .
docker save bettercal:latest | gzip > bettercal-arm64.tar.gz
# SCP to NAS, then on NAS: docker load < bettercal-arm64.tar.gz && docker compose up -d
```

## Troubleshooting

### Port 3000 Already in Use

```bash
# Find and kill the process
lsof -i :3000 | grep node | awk '{print $2}' | xargs kill -9

# Or change the port in docker-compose.yml
# Change `ports: 3000:3000` to `ports: 3001:3000`
```

### Postgres Connection Failed

```bash
# Check container is running
docker compose ps db

# Check logs
docker compose logs db

# Test password
docker exec -it bettercal-db-1 psql -U postgres -d bettercal
# Password: postgres
```

### Migrations Failed

```bash
# View detailed error
docker compose logs app

# Manual test
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/bettercal" tsx src/db/migrate.ts
```

### Out of Memory

Docker containers on Synology NAS may be memory-constrained. In `docker-compose.yml`:
- Reduce `mem_limit` for db/app
- Ensure NAS has 8GB available (your DS218+ should be fine)

## Next Steps

1. **Test locally** with `docker compose up -d` and `open http://localhost:3000/demo/intro`
2. **Build for ARM64** with `docker buildx build --platform linux/arm64 -t bettercal:latest .`
3. **Deploy to Synology** by saving, transferring, and running the image there
4. **Enable OAuth** (optional) by setting `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, etc. in `.env`
5. **Run behind a proxy** (nginx/Caddy) for HTTPS and multiple domains
