# BiteMap NOVA

BiteMap NOVA is an evidence-led freshwater fishing intelligence platform for
Northern Virginia and nearby Potomac and Shenandoah waters. It answers a
practical question: where should I fish, what should I target, and when should I
go—without pretending a score guarantees a catch.

The current Phase 1 slice includes a polished map-first web app, 50 verified
public fishing access locations plus 13 Virginia DWR designated stocked-trout
reaches, species and alias search, evidence-gated rankings, address- or ZIP-based
travel estimates, Google Maps directions, live NWS five-day outlooks, 19 manually
reviewed USGS location-to-gage associations, 94 normalized regional USGS Aquatic
GAP samples, location details, methodology, an authenticated administrator
data-health screen, identity-aware favorites, an independent FastAPI service,
PostGIS/Redis Compose services, migrations, and tests.

## Requirements on Windows

- Windows 10 or 11
- Node.js 22.13 or newer (`node --version`)
- Python 3.11 or newer (`py -3 --version`)
- Docker Desktop only if you want the full PostGIS/Redis stack

PowerShell is the supported command shell. WSL, Bash, Make, Unix `cp`, and Unix
`export` are not required.

## Web app

```powershell
npm install
npm run dev
```

Open the exact local URL printed by the development server. If port 3000 is
already occupied, it will normally choose the next available port.

Production checks:

```powershell
npm run build
npm test
```

If an npm installation appears to pause for a long time, let it finish its
network retries. If needed, clear only the project-local cache and retry:

```powershell
Remove-Item -LiteralPath .npm-cache -Recurse -Force -ErrorAction SilentlyContinue
npm install --cache .npm-cache
```

## FastAPI independently

```powershell
py -3 -m venv .venv
Set-ExecutionPolicy -Scope Process Bypass
.\.venv\Scripts\Activate.ps1
py -3 -m pip install -r apps\api\requirements.txt
Copy-Item .env.example .env
$env:DATABASE_URL = "sqlite:///./bitemap.db"
py -3 -m uvicorn apps.api.app.main:app --reload --port 8000
```

Open `http://localhost:8000/docs` for interactive OpenAPI documentation.

Run API tests:

```powershell
$env:PYTHONPATH = "apps\api"
py -3 -m unittest discover -s apps\api\tests -v
```

## Full stack with Docker Desktop

```powershell
Copy-Item .env.example .env
docker compose up --build
```

The web app listens on `http://localhost:3000`, FastAPI on
`http://localhost:8000`, PostgreSQL/PostGIS on port 5432, and Redis on port
6379.

Apply the production-style database migration:

```powershell
docker compose run --rm api alembic upgrade head
```

## Data honesty

- Access records are seeded from Virginia DWR’s public boating-access service.
- Species evidence is attached only when a separate official DWR source supports it.
- Access-only records remain searchable but do not rank for a species.
- Missing live observations remain unavailable; the app does not invent a fallback.
- Activity values in the seed snapshot are labeled seasonal estimates.
- Live detail outlooks use NWS time of day, wind, precipitation, and official
  alerts. Air temperature is never presented as water temperature.
- USGS gage data are provisional; connected-reach associations reduce confidence
  and never establish boating or wading safety.
- Aquatic GAP presence records are historical nearby-reach evidence and are
  capped; they are not treated as exact access-point surveys.
- A DWR stocked-water designation does not confirm the latest stocking date or
  that stocked fish remain.
- Address-based drive and walking times are clearly labeled approximations; Google Maps provides the final route.
- The opportunity index is not a catch probability or guarantee.
- Always verify regulations, closures, weather, and water safety with the official authority.

## Documentation

- [Architecture and implementation plan](docs/ARCHITECTURE.md)
- [API design](docs/API.md)
- [Data sources](docs/DATA_SOURCES.md)
- [Data licensing](docs/DATA_LICENSES.md)
- [Model card](docs/MODEL_CARD.md)
- [Roadmap](docs/ROADMAP.md)
- [Prioritized TODO](docs/TODO.md)
