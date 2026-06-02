# Production Deployment

## Overview

BetterCal runs as a **multi-service Docker Compose stack**: a Next.js app + PostgreSQL database. The stack is optimized for ARM64 (Synology DS218+ NAS with 8GB RAM) but runs anywhere Docker is available.

**Architecture:**
- **Database**: PostgreSQL 16 (Alpine), ~256MB memory, read-write to persistent volume
- **App**: Next.js standalone server on node:20-alpine, ~512MB memory, migrations + seeding on startup
- **External Integrations**: Gated by environment flags (demo calendar, console email, optional real providers)

## Building for Synology DS218+

The Cortex-A53 CPU is too slow to build the Next.js app locally. **Build off-device** and transfer the image.

### Step 1: Build ARM64 Image Locally

```bash
docker buildx build --platform linux/arm64 -t bettercal:latest .
docker save bettercal:latest | gzip > bettercal-arm64.tar.gz
# Transfer bettercal-arm64.tar.gz to NAS via SCP, USB, or Synology file browser
```

### Step 2: Load on NAS and Start

```bash
# SSH into NAS (or use Synology SSH service)
ssh admin@192.168.x.x

# Load the image
docker load < bettercal-arm64.tar.gz

# Edit docker-compose.yml:
#   - Comment out `build: .` in the app service
#   - Uncomment `platform: linux/arm64` (optional, for explicitness)
#   - Set `image: bettercal:latest`

# Start the stack
docker compose up -d

# Tail logs
docker compose logs -f app
```

### Step 3: Access

Open http://192.168.x.x:3000 in a browser. The demo host is already seeded at `/demo/intro`.

## Configuration

### Environment Variables

Set in `docker-compose.yml` > `services.app.environment` or `.env`:

| Variable | Default | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | `postgresql://postgres:postgres@db:5432/bettercal` | Postgres connection (required) |
| `SEED_DEMO` | `true` | Seed demo host + event on startup |
| `NEXTAUTH_SECRET` | (none) | Enable OAuth if provided |
| `NEXTAUTH_URL` | `http://localhost:3000` | OAuth redirect (set to NAS IP in prod) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | (none) | Google Calendar integration |
| `RESEND_API_KEY` | (none) | Resend email (real email notifications) |
| `ENCRYPTION_KEY` | (random) | Credential encryption; leave unset for auto-generated |

For a **clean production install** (no demo), set `SEED_DEMO=false`.

### Persistence

- **Database**: `pgdata` volume (named Docker volume, survives container restarts)
- **Logs**: Container stdout (view with `docker compose logs`)
- **Config**: All state in Postgres; no external files to backup (aside from the volume)

## Maintenance

### Backup

```bash
docker exec bettercal-db-1 pg_dump -U postgres bettercal | gzip > bettercal-backup.sql.gz
```

### Restore

```bash
zcat bettercal-backup.sql.gz | docker exec -i bettercal-db-1 psql -U postgres bettercal
```

### Update to Latest Image

```bash
docker compose down
docker pull bettercal:latest
docker compose up -d
```

(Migrations run automatically on startup.)

## Troubleshooting

### App Won't Start

```bash
docker compose logs app
```

Common issues:
- **Migration failed**: Check Postgres is healthy (`docker compose logs db`)
- **PORT already in use**: Change `ports: 3000:3000` to `3001:3000` in compose
- **Out of memory**: Increase `mem_limit` for app/db, or close other containers

### Postgres Won't Start

```bash
docker compose logs db
```

Common issues:
- **Volume corrupted**: `docker compose down -v` (warning: deletes data), then `docker compose up -d`
- **Disk full**: Check NAS free space; 5GB minimum recommended for pgdata

### Slow Performance

The Cortex-A53 is single-threaded and slow. For **80+ concurrent users**:
- Add a caching layer (Redis)
- Offload static assets to a CDN
- Upgrade to a faster NAS or move to a VPS

For typical use (< 20 users), the current setup is fine.

## Security

- **HTTPS**: Run behind a reverse proxy (nginx on NAS or cloud provider)
- **Firewall**: Postgres listens only on the Docker network (not exposed)
- **Credentials**: Store `DATABASE_URL` and secrets in Synology's **Container Manager** > Environment, not in git
- **Backups**: Encrypt pgdata backups before transferring off-NAS

## Advanced: Custom Domain + HTTPS

If hosting on a NAS with public IP or behind your router:

1. **Get a domain** (e.g., `bettercal.example.com`)
2. **Point DNS** to your NAS IP
3. **Run Caddy** as a reverse proxy:
   ```yaml
   caddy:
     image: caddy:alpine
     ports:
       - "80:80"
       - "443:443"
     volumes:
       - ./Caddyfile:/etc/caddy/Caddyfile
       - caddy_data:/data
   ```
   
   **Caddyfile**:
   ```
   bettercal.example.com {
     reverse_proxy app:3000
   }
   ```

## Deployment on VPS or Cloud

For **scalable self-hosting** (DigitalOcean, Linode, AWS):

1. Replace Postgres Alpine with a managed DB or larger VM
2. Use `docker buildx build --platform linux/amd64 …` to build for x86_64
3. Deploy via Docker Compose or Kubernetes
4. Proxy via Caddy/nginx with HTTPS
5. Enable OAuth (Google) for multi-user setup

See the main **README.md** for OAuth setup instructions.
