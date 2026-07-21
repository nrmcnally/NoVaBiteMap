# BiteMap NOVA

BiteMap NOVA is an evidence-led freshwater fishing intelligence platform for
Northern Virginia and nearby Potomac and Shenandoah waters. It answers a
practical question: where should I fish, what should I target, and when should I
go—without pretending a score guarantees a catch.

The current Phase 1 work in progress includes a polished map-first web app and a
252-entry research catalog. Of those entries, 143 have authority-verified public
access and 109 are *listed* waters whose exact fishing waypoint or access still
requires review. The runtime currently contains 1,351 independently reviewed
direct species claims at 199 locations plus 349 clearly modeled/nearby-reach
records; modeled records are not equivalent to exact-water observations. In
total, 213 waters carry some evidence and 39 remain honestly empty.

The product also includes species and alias search, evidence-gated rankings,
address- or ZIP-based travel estimates, Google Maps directions, live NWS
five-day outlooks, 19 manually reviewed USGS location-to-gage associations, 225
normalized regional USGS Aquatic GAP samples, 13 Virginia DWR designated
stocked-trout reaches, location and fish details, methodology, an administrator
data-health screen, account-backed favorites, an independent FastAPI service,
PostGIS/Redis Compose services, migrations, and tests. Phase 1 is not
release-complete: access verification, scheduled ingestion, and broader alpha
QA remain open.

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
py -3 -m pytest apps\api\tests -q
```

## Full stack with Docker Desktop

```powershell
Copy-Item .env.example .env
# Replace POSTGRES_PASSWORD in .env before sharing the server.
docker compose up --build
```

The production-built web app listens on `http://localhost:3000`. FastAPI,
PostgreSQL/PostGIS, and Redis remain on the private Compose network rather than
being exposed to the host. Create an email/password account from the Account
page; sessions use HTTP-only cookies and favorites are owned by that account.

The API container applies migrations and loads the canonical seed automatically
when it starts. To run the migration manually:

```powershell
docker compose run --rm api alembic upgrade head
```

For a small tester release, use the
[alpha test checklist](docs/ALPHA_TEST_CHECKLIST.md). Signed-in testers can send
private feedback from any page or report a specific spot from its detail page.
Allowlisted administrators review those reports at `/admin/data-health`;
feedback never changes evidence or scores automatically.

## Data honesty

- Verified access records come from the responsible public authority; `listed`
  entries are discovery candidates and must not be described as verified access.
- Every live direct species claim has an explicit independent source verdict.
  Rejected source/location/species triples are blocked on both runtime surfaces.
- Nearby Aquatic GAP and drainage-inferred records are labeled modeled, capped,
  and kept separate from direct exact-water evidence.
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
- [Alpha test checklist](docs/ALPHA_TEST_CHECKLIST.md)
