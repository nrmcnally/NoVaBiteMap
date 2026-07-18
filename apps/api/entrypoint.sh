#!/usr/bin/env sh
set -e

case "$DATABASE_URL" in
  sqlite*)
    # SQLite backend (e.g. Railway/Render with a mounted volume). The app's
    # startup lifespan (app/main.py) creates the schema via create_all and seeds
    # it if empty, so we skip the Postgres-only Alembic migration + loader here.
    echo "[bitemap-api] SQLite backend detected; schema + seed handled at app startup."
    ;;
  *)
    echo "[bitemap-api] Running database migrations..."
    alembic upgrade head

    # Idempotent load of the canonical seed export. Safe to run every boot: the
    # loader upserts and records a DataIngestionRun; it no-ops if data is unchanged.
    # A genuine load failure is FATAL (set -e): booting on an empty DB would
    # silently serve snapshot fallback, so we fail loud and let the orchestrator retry.
    if [ -f "app/data/seed_export.json" ]; then
      echo "[bitemap-api] Loading canonical seed data..."
      python -m app.data.loader
    else
      echo "[bitemap-api] ERROR: app/data/seed_export.json missing; refusing to start empty." >&2
      exit 1
    fi
    ;;
esac

echo "[bitemap-api] Starting API server..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
