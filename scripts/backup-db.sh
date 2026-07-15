#!/usr/bin/env sh
# Daily Postgres backup for the AIPSA ERP stack.
#
# Dumps the `postgres` compose service to a gzipped file and keeps the last N days.
# Designed to run from host cron (see docs/SERVER-DEPLOYMENT.md). It is NOT a
# running container, so it has zero standing memory cost.
#
# Scope: this is a mistake-shield against a bad command, a bad migration, or an
# accidental `docker compose down -v`. A dump sitting on the same droplet does NOT
# survive a disk failure — for that, ship the dumps off-box (e.g. DigitalOcean
# Spaces). That off-box copy is deliberately future scope.
set -eu

BACKUP_DIR="${BACKUP_DIR:-/var/backups/aipsa-db}"
DB_NAME="${POSTGRES_DB:-aipsaerp}"
DB_USER="${POSTGRES_USER:-aipsaerp}"
RETAIN_DAYS="${RETAIN_DAYS:-7}"

# The script lives in <repo>/scripts; the compose file is one level up.
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
COMPOSE_DIR="$(dirname "$SCRIPT_DIR")"

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d_%H%M%S)"
OUT="$BACKUP_DIR/${DB_NAME}_${STAMP}.sql.gz"

# -T disables the TTY so this works under cron. pg_dump runs inside the postgres
# container, so the host needs no Postgres client tools installed.
docker compose -f "$COMPOSE_DIR/docker-compose.yml" exec -T postgres \
  pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$OUT"

# Guard: a near-empty file means the dump failed — remove it and exit non-zero so
# cron surfaces the error instead of silently "succeeding".
if [ ! -s "$OUT" ]; then
  echo "backup-db: dump is empty, removing $OUT" >&2
  rm -f "$OUT"
  exit 1
fi

# Rotation: delete dumps older than RETAIN_DAYS so backups never fill the disk
# (a full disk crashes Postgres).
find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" -type f -mtime "+${RETAIN_DAYS}" -delete

echo "backup-db: wrote $OUT"
