# BiteMap NOVA TODO

This backlog is ordered by product dependency. Phase 1 reliability comes before
new surface area; the spot and fish-detail work follows once the data pipeline is
operationally dependable.

## Sprint 1 status (2026-07-14) — intelligence core on a real database

Decision: FastAPI + PostgreSQL/PostGIS is the canonical backend; the site becomes a
public standalone app (email auth). Delivered this sprint:

- **Canonical DB is now the runtime source of truth.** New entities (waterbodies,
  aliases, stocking, hydrology stations + associations, species scoring profiles,
  ingestion runs) + Alembic `0002`. Container entrypoint runs migrations + seed.
- **Single source of truth for seed data.** `scripts/export-seed.mts` emits
  `apps/api/app/data/seed_export.json` from the audited TS dataset; a Python loader
  upserts it idempotently and records a `DataIngestionRun`. The duplicate Python
  seed modules were retired.
- **Scoring wired to DB evidence.** Availability/quality combined by the engine
  (noisy-OR + modeled cap + absence penalty); confidence is measured from evidence
  count/recency/authority/hydrology, not hardcoded constants.
- **Species-specific activity model.** Researched, cited per-species profiles
  (temp bands, spawn, diel, waterbody fit, seasonal curve) drive an hourly score
  with real sunrise/sunset; flow feeds activity; measured water temperature is used
  and air temperature is never mislabeled. Trout and bass no longer score alike.
- **Multi-species "Fish at this water / what's biting" panel** on the location page,
  consuming the DB-backed API with graceful evidence-only fallback.
- **Real data-health** endpoint derived from ingestion runs + live counts.
- **Tests:** 46 pytest (scoring combination, species activity, sunrise/sunset + DST,
  loader idempotency, favorites CRUD, multi-species + forecast endpoints) + 9 JS.

## Sprint 2 status (2026-07-14) — fish detail + verified coverage

- **Fish "learn more" feature.** Each species in the spot-level panel expands
  (zero-JS `<details>`) to a fish-facts drawer: preferred/tolerance water temps,
  typical size + Virginia DWR citation size, bite-time pattern, spawn window,
  productive baits, habitat, and stocking (designation-level, honest that the
  latest stock date is not in our data). New `/fish/[id]` species guide pages with
  identification, seasonal techniques, and every water that has evidence. Backed by
  a cited research pass merged into `species_profiles.json` (v1.1) and served via an
  enriched `/api/species/{id}` + the multi-species panel.
- **Rappahannock watershed coverage** (previously entirely absent): 4 access points
  — Kelly's Ford, Motts, Fredericksburg City Docks, Hopyard Landing — verified
  against the live DWR boating-access ArcGIS layer (real coordinates), with
  accurately-sourced smallmouth/redbreast (upper) and largemouth/channel-catfish
  (tidal) evidence. Now 67 locations / 99 evidence records / 45 with evidence.

## Coverage sprint — multi-source waters (2026-07-14)

Expanded the catalog from 67 → 95 public waters from multiple authoritative
sources, with an **access-status model** so honesty scales with breadth:

- `accessStatus`: **verified** (agency-confirmed public access) / **listed**
  (named water on public parkland, exact access not pinpointed) / **unverified**
  (reserved for future discovery tier). Surfaced as chips on results, the map,
  and the detail page.
- **DWR boating access** (region-wide ArcGIS, `scripts/ingest-dwr-access.mts`):
  +21 verified public ramps not already curated (Shenandoah forks, Rapidan River).
- **NHD named waters × public parks** (`scripts/ingest-nhd-waters.mts`): a spatial
  join of USGS NHD named lakes/ponds against the ESRI USA Parks layer keeps only
  waters on public land (+7 listed) and **excludes every private community lake**
  (Barcroft, Montclair, Manassas, the Reston lakes never appear) and unnamed
  stormwater/infrastructure ponds.

**Evidence coverage (2026-07-14):** the authoritative per-water species source is
Virginia DWR waterbody pages + Fisheries Management Reports. Researched for every
named lake/reservoir/river → `waterbody-species-nova.json` (byKey + byWaterbody),
attached by waterbody/display-name. For waters DWR does not document per-water
(small streams, small park ponds) BiteMap adds **clearly-labeled basin inference**
(`inferredEvidenceFor` in expanded-coverage.ts): a tributary of a documented
smallmouth river gets low-confidence "inferred" smallmouth/redbreast; a park pond
gets largemouth/bluegill — flagged modeled, "not a survey", shown as an "Inferred
(basin)" badge, and only used when a water has no documented evidence. Every water
now shows fish (71 documented, rest inferred); only spotted bass has zero evidence
region-wide (correctly — not documented here).

**Honest finding on the ceiling:** NOVA's genuinely-public, named, fishable water
universe is bounded — most named ponds are private HOA/community lakes the app
must not list. To go beyond ~95 honestly, the levers are: per-county park GIS
(Fairfax/PWC/Loudoun have far more small park ponds than the national USA Parks
layer captures), named-stream ingestion (NHD flowlines), nearby MD/DC waters
(one-line region change), and hand-curated county park fishing waters. None of
these should relax the private-property exclusion.

## Sprint 2.1 — UX fixes + fish glossary (2026-07-14)

- **Fish glossary** at `/fish` (new top-nav "Fish guide" tab): all 20 species A–Z,
  each linking to its guide. Image registry (`app/lib/fish-images.ts`) ready for
  verified photos; shows a tasteful placeholder until then.
- **Navigation delay fixed**: the server-rendered spot/fish pages no longer stall
  on a doomed API fetch. The API client fast-fails (no localhost fetch in prod, 2.5s
  cap) and `loading.tsx` gives instant nav feedback.
- **Explore without a target species**: the map colors and the results list now
  rank every water by its strongest evidenced fish ("Top target: …" on each card,
  heading "Best fish by water"); selecting a spot works with no species chosen.
- **Top filter dropdowns close on outside click / Escape.**
- **Search-bar area cleanup**: the pine-green "Target species" button is toned to
  match the other filters, and the off-screen results panel no longer creates a
  horizontal scrollbar.

### Flagged follow-ups (honesty / sourcing constraints)

- [ ] **Fish photos.** Data model + UI are ready (attribution fields, placeholder-
  free). Actual images are deferred: each asset needs individual public-domain /
  compatible-license verification (USFWS, Wikimedia) and a file download. Do a
  curated batch once approved.
- [ ] **Real last-stock dates.** Ingest the DWR recently-stocked-trout feed so the
  drawer can show actual dates instead of the designation only.
- [ ] **Remaining coverage waters.** Bull Run (stream), Four Mile Run, Difficult
  Run, Goose Creek, Broad Run, Cedar Run, Hunting Run Reservoir, and Motts Run
  Reservoir have NO DWR boating-access record (no state ramp). Adding them needs a
  different authoritative source with a verifiable coordinate (county park pages,
  DWR stocked-trout layer) — do not fabricate coordinates.
- [ ] Link species names in the Explore results/filters to `/fish/[id]`.

Still open: scheduled ingestion + admin UI rewire, email auth UI + favorites
migration off D1, search/map depth. Frontend still reads `data.ts` for the
single-species outlook; full migration to the API is in progress.

## P0 — close Phase 1

### Canonical ingestion and persistence

- [ ] Move normalized DWR, USGS Aquatic GAP, USGS Water, and NWS records into the
  canonical database instead of relying on bundled snapshots and request-time
  fetches alone.
- [ ] Add scheduled, idempotent provider jobs with checksums and source-version
  metadata.
- [ ] Record every ingestion attempt, provider response time, record count,
  validation result, error, and last successful refresh.
- [ ] Add bounded retries with backoff and a last-known-good fallback.
- [ ] Prevent a partial or malformed provider response from replacing healthy
  production data.
- [ ] Expose job history, freshness, failures, and manual refresh controls only
  in the administrator data-health screen.
- [ ] Add integration tests for duplicate imports, provider outages, stale data,
  malformed records, and recovery after failure.

### Phase 1 coverage and release QA

- [ ] Audit map coverage around Arlington, Alexandria, Fairfax, Loudoun, and
  Prince William for missing public access points and accidental geographic
  clustering.
- [ ] Verify every location-to-USGS-gage association and document same-waterbody
  versus connected-reach confidence.
- [ ] Test favorites, filter changes, address/ZIP travel estimates, Google Maps
  directions, and advisory filters as complete user journeys.
- [ ] Complete keyboard, screen-reader, mobile, tablet, and cross-browser QA.
- [ ] Confirm every public claim has visible provenance, freshness, and an honest
  unavailable/insufficient-evidence state.

## P1 — improve fishing-spot details

### Fish present at this spot

- [ ] Add a “Fish at this water” section listing every supported species with
  evidence for the selected location.
- [ ] Distinguish direct observations, official stocking records, nearby historic
  reach evidence, and modeled evidence; never present them as equivalent.
- [ ] Show evidence date, source, distance/association where relevant, and
  confidence for each species.
- [ ] Use “not confirmed here” when evidence is missing; never turn missing data
  into a claim that a fish is absent.
- [ ] Allow a species row to become the active detail-page species and preserve
  that selection in the URL.

### What is and is not biting

- [ ] Show a current opportunity state for each evidenced species: strong, fair,
  low, or insufficient evidence.
- [ ] Include the current score, confidence, best upcoming window, five-day
  direction, and the top positive and negative factors.
- [ ] Sort confirmed species by current opportunity while keeping insufficient-
  evidence species visibly separate.
- [ ] Explain that “low opportunity” is a conditions-based estimate, not proof
  that the species will not bite.
- [ ] Apply official weather/water safety caps before displaying any bite label.
- [ ] Keep consumption advisories and regulations species-specific and tied to
  the applicable water segment.

### Spot-detail acceptance criteria

- [ ] A user can answer “what lives here?”, “what is worth targeting now?”, and
  “why?” without leaving the page.
- [ ] No species receives a bite ranking without passing the existing evidence
  gate.
- [ ] Stale, nearby, or low-confidence evidence is unmistakably labeled.
- [ ] The layout remains useful when a spot has one species, many species, or no
  qualifying species evidence.

## P1 — fish detail pages

Create `/fish/[species-id]` pages and link them from filters, spot details, and
search results.

### Fish profile content

- [ ] Common and scientific names, family, identification traits, typical size,
  native/introduced status, and regional range.
- [ ] Preferred habitat, depth, structure, current, clarity, and spawning period.
- [ ] Bite-pattern factors: season, time of day, light, precipitation, flow,
  measured water temperature when available, and major weather changes.
- [ ] Productive natural baits, artificial lures/flies, presentations, retrieve
  styles, tackle guidance, and shore/wade/boat considerations.
- [ ] Conservation, handling, invasive-species, and ethical-release notes.
- [ ] Official Virginia regulation links with a reminder that rules vary by
  water, season, size, and harvest method.
- [ ] A map/list of locations where BiteMap has qualifying evidence for the fish,
  plus current top opportunities with confidence shown.
- [ ] Sources and a “last reviewed” date for factual profile content.

### Fish imagery and licensing

- [ ] Prefer accurate documentary photographs over generated identification
  images.
- [ ] Use only public-domain or explicitly compatible licensed images; verify the
  license on each individual asset rather than assuming an entire site is free.
- [ ] Store creator, source URL, license name/version, license URL, modification
  status, and required attribution alongside every image.
- [ ] Consider USFWS or other government media when the individual asset is
  confirmed public domain, and Wikimedia Commons when the individual file's
  license and attribution requirements are compatible.
- [ ] Download and optimize approved assets instead of depending on fragile
  third-party hotlinks.
- [ ] Add descriptive alt text and a visible photo credit/license link.

### Fish-page data model

- [ ] Add a structured species-profile record rather than embedding long prose in
  page components.
- [ ] Model seasonal bite factors separately from live observations so air
  temperature is never mislabeled as water temperature.
- [ ] Add structured techniques, baits, habitats, citations, and licensed media.
- [ ] Add content-review status and reviewed-at fields for safe editorial updates.
- [ ] Add API and rendered-contract tests for missing profiles, missing images,
  attribution, citations, and species-to-location links.

## P2 — follow-on improvements

- [ ] Compare multiple target species at a spot without combining them into one
  misleading score.
- [ ] Let users save preferred species and default tackle/access styles.
- [ ] Add private trip notes and zero-catch reporting to improve later validation.
- [ ] Add stocking and severe-weather notifications after notification controls
  and user preferences exist.

## Recommended sequence

1. Finish scheduled ingestion, persistence, audit history, and fallbacks.
2. Build the spot-level species evidence and “what is biting” panel.
3. Launch fish pages for the most common regional species with sourced text but
   placeholder-free imagery only where licensing is complete.
4. Expand fish profiles and licensed photography species by species.

