# Canonical data pipeline

BiteMap's runtime source of truth is the database. Curated location/evidence data is
authored in TypeScript (`app/lib/*`, the reviewed dataset), exported to a normalized
JSON snapshot, and loaded into PostgreSQL/PostGIS (or SQLite for local dev). This
keeps one human-editable source while making the database authoritative at runtime.

```
app/lib/data.ts (audited TS dataset)
        │  npx tsx scripts/export-seed.mts
        ▼
apps/api/app/data/seed_export.json  +  apps/api/app/data/species_profiles.json
        │  python -m app.data.loader   (idempotent upsert, records a DataIngestionRun)
        ▼
PostgreSQL/PostGIS  ──►  FastAPI  ──►  Next.js frontend
```

## Regenerate the seed export (after editing app/lib data)

```powershell
npx tsx scripts/export-seed.mts
```

## Run the API locally with SQLite (no Docker)

SQLite auto-creates the schema and auto-seeds on first boot.

```powershell
Copy-Item .env.example .env
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r apps\api\requirements.txt
cd apps\api
uvicorn app.main:app --reload --port 8000
```

Reseed explicitly (idempotent; unchanged data is a no-op):

```powershell
cd apps\api
python -m app.data.loader
```

## Run the full stack with Docker (PostgreSQL/PostGIS + Redis)

The API container runs `alembic upgrade head` and loads the seed before serving
(`apps/api/entrypoint.sh`).

```powershell
Copy-Item .env.example .env
docker compose up --build
```

## Point the frontend at the API

```powershell
$env:API_BASE_URL = "http://127.0.0.1:8000"
npm run dev
```

The frontend degrades gracefully if the API is unreachable: the location page still
renders the known-species evidence list, and the scored "what's biting" ranking
appears when the API is available.

## Tests

```powershell
# Python (SQLite, isolated temp DB)
cd apps\api
python -m pytest -q

# Frontend build contract + advisories
npm test
```

## Notes on honesty guarantees

- Availability/quality are combined by the scoring engine (noisy-OR corroboration,
  a modeled-evidence ceiling, and an absence penalty), not copied from a single
  literal. A single curated record passes through unchanged, so audited numbers do
  not regress.
- Confidence is measured from evidence count, recency, source authority, agreement,
  and whether a verified USGS association exists — not a fixed constant.
- The hourly activity model uses a researched per-species profile and real
  sunrise/sunset. Air temperature is never treated as water temperature; a measured
  USGS water temperature is required before the temperature term bites.
- Provider failures never fabricate values: the app falls back to the seasonal
  estimate with reduced confidence and labels it accordingly.
