#!/usr/bin/env sh
set -e

echo "[bitemap-api] Running database migrations..."
alembic upgrade head

# Idempotent load of the canonical seed export. Safe to run every boot: the
# loader upserts and records a DataIngestionRun; it no-ops if data is unchanged.
if [ -f "app/data/seed_export.json" ]; then
  echo "[bitemap-api] Loading canonical seed data..."
  python -m app.data.loader || echo "[bitemap-api] Seed load skipped (non-fatal)."
fi

echo "[bitemap-api] Starting API server..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
