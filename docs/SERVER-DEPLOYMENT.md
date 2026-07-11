# Server Deployment (Docker Compose)

Self-hosted deployment for the EduBridge / AIPSA ERP platform. One public port,
an internal-only database, and file uploads stored on the server's own disk — no
external cloud storage required.

## Topology

```
                 :3121  (the only published port)
  browser ──────────────►  web  (Next.js)
                             │  server-side proxy  /api/proxy/*
                             ▼
                           api  (Express)  ──►  postgres
                             │                   (internal only)
                             ▼
                        uploads_data volume  (/app/uploads)
```

- **web** — the single public entry point, published on host port **3121**.
- **api** — internal only (`expose: 5000`). The browser never calls it directly;
  the Next.js app proxies every `/api/*` request over the compose network.
- **postgres** — internal only (`expose: 5432`, no host port). Reachable by the
  API as `postgres:5432`, never from outside the host.
- **uploads_data** — a named volume mounted at `/app/uploads`, so files uploaded
  with `STORAGE_DRIVER=local` survive container rebuilds.

## File storage

`STORAGE_DRIVER=local` (set in `docker-compose.yml`) writes uploads to the
`uploads_data` volume. The API serves them back statically at `/api/files/<key>`;
the browser loads them through the proxy path `/api/proxy/files/<key>`, so the API
still needs no public port. Cloud drivers (`cloudinary`, `spaces`) remain
available by changing the env var.

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

4. App is available at `http://<server-ip>:3121`. Put a reverse proxy (nginx /
   Caddy) with TLS in front of 3121 for a public domain.

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
