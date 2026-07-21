# BiteMap NOVA TODO

This backlog is ordered by product dependency. Phase 1 reliability comes before
new surface area; the spot and fish-detail work follows once the data pipeline is
operationally dependable.

## Post-alpha: productionization / regional-scale gaps → see [docs/SCALING.md](SCALING.md)

Recorded 2026-07-17. The data model (on-demand fetch + short cache, no poller) is
the right foundation, but three things are alpha simplifications that won't hold up
for a public region-wide site. Do NOT block the closed alpha on these; address
before public launch. Priority order:

- [ ] **Per-NWS-gridpoint forecasts** (retire the single Fairfax map anchor) — biggest
      accuracy win; same work as the gameplanned scrubber upgrade.
- [ ] **Enable shared cache (Redis / Cloudflare KV)** so horizontal scaling doesn't
      fragment the cache and hammer NWS/USGS.
- [ ] **Key the weather cache on gridpoint, not exact coordinate** (kills redundant fetches).
- [x] **Converge map + detail on the canonical scoring engine.** Explore now
      precomputes a canonical Python score matrix; remaining differences are the
      disclosed regional-anchor versus spot-specific environmental inputs.
- [ ] **Cache-stampede / rate-limit protection** (stale-while-revalidate + single-flight).

## Phase 1 audit checkpoint (2026-07-18)

Working completion estimate: **about 84-87% overall**. The alpha product, account
flow, core scoring architecture, timeline, trip logging, and regional catalog are
substantially built. The production container path and persistence restart test
are green. Phase 1 completion is now held back mainly by access review, the
remaining honest evidence gaps, ingestion hardening, accessibility/cross-browser
QA, and real-angler alpha feedback.

Current audited baseline:

- **252 catalog entries:** 143 authority-verified access points and 109 `listed`
  public-land waters whose exact fishing access/waypoint still needs review.
- **199 locations have live direct species evidence; 14 are modeled-only and 39
  remain honestly empty.**
- **1,351 live direct claims independently verified/corroborated; 105 unsupported
  source/location/species triples rejected; 0 live direct claims left unchecked.**
- **349 modeled records** remain available as visibly qualified fallback context.
- The review queue has 49 waters with no direct candidate in the current primary
  source set, one with only a non-target community-fish candidate, and two with
  historical-only primary-source records that do not establish current presence.
- Coverage stabilization added structured permit, credential, age, harvest,
  seasonal, license, and vessel restrictions for 17 access points. Unsupported
  tidal/park wading claims were removed.
- Carter's Pond, Hanson Park, Springhouse Pond, and Clearbrook Lake now have
  current exact-water species claims from official sources. Lake Thompson's 2015
  DWR community remains in the research ledger as historical only.
- Bull Run, Goose Creek, Broad Run, and Hunting Run are represented. **Motts Run
  Reservoir remains a named-water coverage gap**; the existing Motts entry is a
  Rappahannock River access point, not the reservoir.

### P0 execution order from this audit

1. Verify or quarantine the 109 `listed` entries. A park-boundary/NHD match is
   not by itself a fishing access point.
2. Research the 39 honest evidence gaps from exact-water agency pages/reports;
   keep historical-only records out of current presence rankings.
3. Add Motts Run Reservoir only after attaching an authoritative fishing-access
   coordinate and permission source.
4. Move DWR/VAFWIS, trout, Aquatic GAP, USGS, and NWS refreshes into scheduled,
   idempotent database jobs with last-known-good protection and admin-only
   controls.
5. Complete browser/mobile/accessibility journeys for search, filters, travel,
   directions, favorites, alerts/advisories, access conditions, and empty/stale
   states. Canonical map/detail model convergence is complete; per-gridpoint map
   weather remains a post-alpha scaling improvement.

### Alpha release hardening completed 2026-07-18

- [x] Build and start the production web/API/PostGIS/Redis stack from clean
  Docker images with health-gated startup.
- [x] Verify account, session, favorite, trip, and tester-feedback persistence
  through a complete stack restart.
- [x] Pass the administrator allowlist into both web and API containers.
- [x] Make production Compose fail fast when the PostgreSQL password or
  real-contact NWS user agent is missing.
- [x] Add signed-in general/spot feedback with D1 and PostgreSQL persistence,
  plus a private administrator review queue.
- [x] Keep tester feedback isolated from automatic evidence or score promotion.
- [x] Add a repeatable friend-alpha checklist.
- [ ] Run the checklist with real anglers and triage every high-impact data
  report through the existing source-verification workflow.
- [ ] Finish keyboard, screen-reader, mobile-device, and cross-browser QA.

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

**Evidence coverage (superseded by the audit above):** authoritative per-water
pages and reports are retained in `waterbody-species-nova.json`. Waters without
direct documentation may receive a low-confidence Aquatic GAP or basin-inference
fallback, but those records are modeled and are never counted as verified
exact-water communities.

**Honest finding on the ceiling:** NOVA's genuinely-public, named, fishable water
universe is bounded — most named ponds are private HOA/community lakes the app
must not list. To go beyond ~95 honestly, the levers are: per-county park GIS
(Fairfax/PWC/Loudoun have far more small park ponds than the national USA Parks
layer captures), named-stream ingestion (NHD flowlines), nearby MD/DC waters
(one-line region change), and hand-curated county park fishing waters. None of
these should relax the private-property exclusion.

## Sprint 2.1 — UX fixes + fish glossary (2026-07-14)

- **Fish glossary** at `/fish` (new top-nav "Fish guide" tab): all 37 species
  currently represented in runtime evidence A–Z. Twenty reviewed target species
  retain bite-scoring profiles; 17 additional fish-community records have
  searchable reference pages but are not given invented activity forecasts.
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

- [x] **Fish photos.** All 37 guide species now have a locally optimized,
  individually license-reviewed public-domain image with visible attribution.
  Documentary federal photos were preferred; identification-grade government
  artwork is used where it presents the fish more clearly.
- [ ] **Real last-stock dates.** Ingest the DWR recently-stocked-trout feed so the
  drawer can show actual dates instead of the designation only.
- [ ] **Remaining prompt waters.** Bull Run proper, Goose Creek, Broad Run,
  Hunting Run Reservoir, and Motts Run Reservoir still need an authoritative
  public-access coordinate and permission source. Cedar Run exists only as a
  listed candidate. Do not fabricate coordinates or equate a waterbody geometry
  with a legal access point.
- [ ] Link species names in the Explore results/filters to `/fish/[id]`.

Still open: scheduled ingestion + admin UI rewire, account recovery/email
verification for a wider beta, and search/map depth. Explore rankings, spot base
records, and My Spots cards now prefer the canonical API/database and use the
bundled evidence snapshot only as an explicit local/hosted fallback.

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

- [x] Move Explore rankings, spot base records, and saved-spot card lookups onto
  one canonical FastAPI payload while preserving an honest bundled fallback.
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

- [x] Add a “Fish at this water” section listing every supported species with
  evidence for the selected location.
- [x] Distinguish direct observations, official stocking records, nearby historic
  reach evidence, and modeled evidence; never present them as equivalent.
- [x] Show evidence date, source, distance/association where relevant, and
  confidence for each species.
- [x] Use “not confirmed here” when evidence is missing; never turn missing data
  into a claim that a fish is absent.
- [ ] Allow a species row to become the active detail-page species and preserve
  that selection in the URL.

### What is and is not biting

- [x] Show a current opportunity state for each evidenced species: strong, fair,
  low, or insufficient evidence.
- [x] Include the current score, confidence, best upcoming window, five-day
  direction, and the top positive and negative factors.
- [x] Sort confirmed species by current opportunity while keeping insufficient-
  evidence species visibly separate.
- [x] Explain that “low opportunity” is a conditions-based estimate, not proof
  that the species will not bite.
- [ ] Apply official weather/water safety caps before displaying any bite label.
- [ ] Keep consumption advisories and regulations species-specific and tied to
  the applicable water segment.

### Spot-detail acceptance criteria

- [x] A user can answer “what lives here?”, “what is worth targeting now?”, and
  “why?” without leaving the page.
- [x] Rejected exact source/location/species triples cannot receive a direct bite
  ranking on either runtime surface. Newly added direct claims still require an
  explicit review entry before release.
- [x] Stale, nearby, or low-confidence evidence is unmistakably labeled.
- [x] The layout remains useful when a spot has one species, many species, or no
  qualifying species evidence.

## P1 — fish detail pages

Create `/fish/[species-id]` pages and link them from filters, spot details, and
search results.

### Fish profile content

- [x] Common and scientific names, family, identification traits, typical size,
  native/introduced status, and regional range.
- [x] Preferred habitat, depth, structure, current, clarity, and spawning period.
- [x] Bite-pattern factors: season, time of day, light, precipitation, flow,
  measured water temperature when available, and major weather changes.
- [x] Productive natural baits, artificial lures/flies, presentations, retrieve
  styles, tackle guidance, and shore/wade/boat considerations.
- [x] Conservation, handling, invasive-species, and ethical-release notes.
- [x] Official Virginia regulation links with a reminder that rules vary by
  water, season, size, and harvest method.
- [x] A map/list of locations where BiteMap has qualifying evidence for the fish,
  plus current top opportunities with confidence shown.
- [x] Sources and a dataset-level “last reviewed” date for factual profile content.

### Fish imagery and licensing

- [x] Prefer accurate documentary photographs over generated identification
  images; use identification-grade agency artwork where it is clearer.
- [x] Use only public-domain or explicitly compatible licensed images; verify the
  license on each individual asset rather than assuming an entire site is free.
- [ ] Store creator, source URL, license name/version, license URL, modification
  status, and required attribution alongside every image.
- [x] Consider USFWS or other government media when the individual asset is
  confirmed public domain, and Wikimedia Commons when the individual file's
  license and attribution requirements are compatible.
- [x] Download and optimize approved assets instead of depending on fragile
  third-party hotlinks.
- [x] Add descriptive alt text and a visible photo credit/license link.

### Fish-page data model

- [x] Add a structured species-profile record rather than embedding long prose in
  page components.
- [x] Model seasonal bite factors separately from live observations so air
  temperature is never mislabeled as water temperature.
- [x] Add structured techniques, baits, habitats, and citations.
- [x] Add licensed media records after individual image-license review.
- [ ] Add content-review status and reviewed-at fields for safe editorial updates.
- [x] Add API and rendered-contract tests for missing profiles, missing images,
  attribution, citations, and species-to-location links.

## P2 — follow-on improvements

- [x] Compare multiple target species at a spot without combining them into one
  misleading score.
- [ ] Let users save preferred species and default tackle/access styles.
- [x] Add private trip notes and zero-catch reporting to improve later validation.
- [ ] Add stocking and severe-weather notifications after notification controls
  and user preferences exist.

## Recommended sequence

1. Finish access verification and the exact-water candidate review queue.
2. Finish scheduled ingestion, persistence, audit history, and fallbacks.
3. **Completed for the alpha journeys:** Explore rankings, spot base records,
   and My Spots cards prefer the canonical API; Fish Guide reference content
   intentionally remains bundled and versioned for offline fallback.
4. Run the limited friend alpha and finish accessibility/cross-browser QA, then
   close the remaining access/evidence verification queue.
