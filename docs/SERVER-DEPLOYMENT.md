# Server Deployment (Docker Compose)

Self-hosted deployment for the EduBridge / AIPSA ERP platform. Each frontend runs
as its own container, an internal-only database, and file uploads stored on the
server's own disk — no external cloud storage required.

## Topology

```
                 :3121  ──►  web        (Next.js, school ERP)
  Caddy (host)                 │  proxy /api/proxy/*
   TLS + domain                ▼
   routing        :5000 ──►  api        (Express)  ──►  postgres
                 :3122  ──►  homeschool (Next.js, B2C)      (internal only)
                               │  proxy /api/proxy/*             │
                               └──────────────────►             ▼
                                                          uploads_data (/app/uploads)
```

- **web** — the school ERP frontend, published on host port **3121**.
- **homeschool** — the B2C home-schooling frontend, published on host port
  **3122**. A separate container, so a crash here cannot take the ERP down (and
  vice-versa). It shares the same **api** and **postgres**.
- **api** — internal only (`expose: 5000`). The browser never calls it directly;
  each frontend proxies its `/api/*` requests over the compose network.
- **postgres** — internal only (`expose: 5432`, no host port). Reachable by the
  API as `postgres:5432`, never from outside the host.
- **uploads_data** — a named volume mounted at `/app/uploads`, so uploaded files
  survive container rebuilds.

Caddy runs on the host (not in compose) and terminates TLS, routing the ERP
domain to `:3121` and the home-schooling domain to `:3122`.

## File storage

Uploads are written to the `uploads_data` volume on the server's own disk. The
API serves them back statically at `/api/files/<key>`; the browser loads them
through the proxy path `/api/proxy/files/<key>`, so the API still needs no public
port. There is no external object store — if a hosted store (S3/Spaces) is needed
in production later, add a driver in `apps/api/src/lib/storage.js`.

## First-time setup

1. Create the env files on the server (never commit these):
   - `apps/api/.env` — from `apps/api/.env.example`
   - `apps/web/.env.local` — set `API_URL=http://api:5000/api`
2. Export a strong DB password: `export POSTGRES_PASSWORD=...`
   (must match the `DATABASE_URL` compose builds).
3. Build and start:

   ```bash
   docker compose up -d --build
   ```

   The API runs `prisma migrate deploy` on start and auto-seeds the super admin
   (from `SUPER_ADMIN_PASSWORD`).

4. Apps are available at `http://<server-ip>:3121` (ERP) and
   `http://<server-ip>:3122` (home-schooling). Point Caddy on the host at each
   port for its domain, e.g.:

   ```
   erp.example.com          { reverse_proxy localhost:3121 }
   homeschool.example.com   { reverse_proxy localhost:3122 }
   ```

## Backups

`scripts/backup-db.sh` dumps the `postgres` service to a gzipped file and keeps
the last 7 days. It is a plain host-cron script (no running container, so no
standing memory cost). Add it to root's crontab to run nightly:

```bash
chmod +x scripts/backup-db.sh
crontab -e
# 0 3 * * *  /path/to/aipsaerp/scripts/backup-db.sh >> /var/log/aipsa-backup.log 2>&1
```

Restore a dump:

```bash
gunzip -c /var/backups/aipsa-db/aipsaerp_YYYYMMDD_HHMMSS.sql.gz \
  | docker compose exec -T postgres psql -U aipsaerp aipsaerp
```

This protects against a bad command or migration. It does **not** survive a
droplet disk failure — for that, copy the dumps off-box (e.g. to Spaces). That
off-box step is future scope.

## Database migrations

The migration files in `apps/api/prisma/migrations` now fully reproduce
`schema.prisma`, so a **fresh** database is built correctly by `prisma migrate
deploy` alone (it runs automatically on API start) — no Neon dump needed.

For an **existing** database that already has the current schema via `prisma db
push` (e.g. the Neon cloud DB), the `20260711000000_backfill_schema_drift`
migration would fail if re-run, because its objects already exist. Mark it as
already-applied once, per such database, before deploying:

```bash
docker compose exec api npx prisma migrate resolve \
  --applied 20260711000000_backfill_schema_drift
```

(Point `DATABASE_URL`/`DIRECT_URL` at the target DB when running this.)

## Common commands

```bash
docker compose logs -f web api     # tail logs
docker compose up -d --build       # redeploy after a pull
docker compose down                # stop (volumes/data preserved)
```
