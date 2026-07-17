#!/usr/bin/env sh
set -e

echo "[bitemap-api] Running database migrations..."
alembic upgrade head

# Idempotent load of the canonical seed export. Safe to run every boot: the
# loader upserts and records a DataIngestionRun; it no-ops if data is unchanged.
# A genuine load failure is FATAL (set -e): booting on an empty DB would silently
# serve snapshot fallback, so we fail loud instead and let the orchestrator retry.
if [ -f "app/data/seed_export.json" ]; then
  echo "[bitemap-api] Loading canonical seed data..."
  python -m app.data.loader
else
  echo "[bitemap-api] ERROR: app/data/seed_export.json missing; refusing to start empty." >&2
  exit 1
fi

echo "[bitemap-api] Starting API server..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
