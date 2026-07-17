# BiteMap NOVA short-term implementation plan

Last updated: 2026-07-16

## Purpose

The short-term finish line is a defensible BiteMap alpha: all 37 researched
species represented, the strongest species receiving evidence-based activity
scores, forecast-constrained time exploration, synchronized map rankings,
understandable score explanations, and centralized source documentation.

The full plan begins after all 11 species-research batches are complete, but the
lossless intake and normalization work can proceed incrementally. It turns the
research into a controlled, versioned model rather than copying candidate rules
directly into production.

Related project references:

- `docs/TODO.md` - broader product backlog and Phase 1 audit
- `docs/ROADMAP.md` - long-term product phases
- `docs/BITE_SCIENCE_ROADMAP.md` - current scientific scoring approach
- `docs/EVIDENCE_METHODOLOGY.md` - evidence standards
- `docs/DATA_SOURCES.md` - provider and dataset provenance
- `docs/WATER_TEMP_MODEL.md` - water-temperature estimation

## Progress snapshot

As of 2026-07-16, numbered Batches 1-11 and the three deeper pilot archives are
preserved and normalized: all 37 expected species, 372 unique sources, 532
evidence records, and 61 possible score rules. The pipeline reports 0 errors
and 12 retained warnings. The planned archive intake is complete, and every
score candidate has a deterministic first-pass disposition. The 22 modelable
rules now have versioned non-production fixtures and 194 passing golden
scenarios; 21 are test-only and fallfish is blocked pending exact peak timing.
The `candidate-v0.2.0` adversarial review reduced six curve magnitudes and chose
only snakehead and walleye diel rules for future offline validation. Human
sign-off and independent observations are still outstanding.

No rule from this intake has been connected to the production scorer. Current
artifacts and review gates are documented in
`research/species/REVIEW_GUIDE.md` and `docs/MODEL_TRANSLATION_AUDIT.md`.

Private alpha trip instrumentation is now implemented for both hosted D1 and
self-hosted PostgreSQL accounts. Anglers record the actual named spot and trip
start/end time; the app does not freeze a forecast. The logger captures effort,
explicit zero-catch outcomes, optional field observations, and per-row consent.
These records remain calibration-only with a hard false validation gate. The
outcome-blind `historical-replay-v0.1.0` pipeline now reconstructs clearly
labeled modeled weather, deterministic solar context, and values from manually
mapped USGS stations on demand. It preserves missingness and cannot promote a
trip into validation. Historical water temperature remains available only where
the mapped USGS series actually supplies it. Signed preregistration, analyst
review tools, and any use of these rows for confirmatory evaluation remain
future work; see `docs/TRIP_LOG_AND_MODEL_CALIBRATION.md`.

## Product and scientific principles

1. Presence, activity, practical opportunity, and data confidence are separate
   concepts. A single score must not obscure those distinctions.
2. A scientifically valid result is not automatically an implementable rule.
   BiteMap must be able to obtain the rule's input at runtime.
3. Feeding, catchability, movement, habitat occupancy, growth, stress, and
   survival are different endpoints and must remain distinguishable.
4. Forecast exploration ends when defensible provider coverage ends. BiteMap
   must not manufacture long-range weather conditions.
5. Modeled inputs such as water temperature and spawning stage must be labeled
   and carry uncertainty.
6. Missing optional data removes the relevant modifier and reduces confidence;
   it is not silently replaced with false precision.
7. Every implemented rule remains traceable to evidence records, sources,
   limitations, and a model version.
8. All 37 species can exist in the product without pretending that all 37 have
   equally mature activity models.

## Milestone 1 - finish and preserve the research

Complete and audit Batches 10 and 11, then preserve every original research ZIP
unchanged as the raw record.

Deliverables:

- all 37 species accounted for;
- original archives, manifests, breadth audits, conflict logs, validation
  reports, and resume packets retained;
- known bibliography and schema problems documented;
- final coverage matrix showing source count, full-text access, evidence count,
  candidate rules, verification status, and research gaps per species.

Definition of done:

- every expected species has a readable JSON, Markdown, and PDF report;
- archive contents pass structural and reference-integrity checks;
- unresolved verification limitations remain explicit rather than being erased.

## Milestone 2 - build the canonical evidence library

Merge the separate archives into one normalized research dataset while keeping
the raw archives immutable.

Normalize:

- species IDs, common names, scientific names, and aliases;
- research and targetability statuses;
- source, evidence, and candidate-rule field types;
- verification terminology;
- confidence labels;
- measurement units and temperature scales;
- locator and zero-weight count semantics;
- production, evidence-informed, context-only, zero-weight, and deferred-input rule
  classifications.

Correct known issues such as incomplete bylines, generic publication links,
duplicate sources, inconsistent year types, and batch-specific schema drift.

Every normalized claim must retain:

- evidence ID;
- source ID;
- exact page, section, table, or figure when available;
- access and verification status;
- geographic applicability;
- population and life stage;
- measurement endpoint;
- limitations and transfer risks.

Definition of done:

- one validator loads every species without batch-specific special cases;
- source and evidence references resolve;
- shared studies are deduplicated without losing species-specific findings;
- normalized output can be regenerated deterministically from the raw archives.

## Milestone 3 - complete the model-translation audit

Review every candidate rule independently of the research archive's initial
recommendation.

Classify each finding as:

- **production score** - appropriate for the initial live model;
- **evidence-informed candidate** - correct-species, relevant-endpoint evidence
  translated with conservative setting, life-stage, and confidence controls;
- **context only** - useful for explanations or the Fish Guide but not scoring;
- **zero-weight/rejected** - unsupported, duplicated, or unsuitable;
- **unavailable** - relevant in principle, but no defensible model or runtime
  data exists.

A production rule must have:

- a feeding, foraging, strike, or hook-and-line catchability endpoint;
- an applicable population and life stage;
- reasonable Northern Virginia transferability;
- a runtime input BiteMap can obtain;
- defined units and a valid input range;
- interpolation and extrapolation restrictions;
- missing-data behavior;
- supporting evidence IDs;
- confidence and geographic-transfer fields;
- double-counting protection.

Rules requiring unknown individual fish length, exact strain, active nest
guarding, or recent capture history generally cannot drive a real-time spot
score unless a defensible population-level proxy is later added.

Definition of done:

- each candidate has a written disposition and rationale;
- no production rule depends on an unavailable runtime input;
- indirect physiology, growth, or habitat results cannot silently become bite
  multipliers;
- contradictory and null findings remain visible.

## Milestone 4 - formalize the score architecture

BiteMap should calculate four distinct components.

### Species presence confidence

How strongly the available evidence supports that the species occurs at the
water. Direct surveys, official stocking, nearby historical records, and modeled
community evidence remain visibly different.

### Bite activity

How favorable the selected conditions are for feeding or catchability. This is
the component driven by the translated species research.

### Practical opportunity

Access, travel, fishing method, waterbody type, and other user-facing factors.
This must not be presented as fish biology.

### Data confidence

How much of the result comes from observations, forecasts, modeled inputs, and
provisional research.

The displayed opportunity score may combine these components, but spot and
species pages must expose them separately.

For the alpha, use a bounded and explainable activity model:

```text
species baseline
+ supported positive modifiers
- supported penalties
+ supported interactions
= activity score capped to 0-100
```

Safeguards:

- weak evidence has limited influence;
- several weak rules cannot overwhelm one strong result;
- temperature, season, spawning, daylight, flow, and oxygen cannot be counted
  twice through correlated rules;
- two measured points do not become a smooth universal curve;
- a growth or thermal-preference optimum is not relabeled as a bite optimum;
- consumption advisories remain separate from biological activity.

## Milestone 5 - create versioned species model configurations

Create a machine-readable configuration for every species containing:

- baseline behavior;
- production and evidence-informed candidate rules;
- required inputs and units;
- evidence and source IDs;
- evidence confidence and regional transferability;
- valid ranges and interpolation behavior;
- interaction and double-counting rules;
- fallback behavior;
- model version and reviewed-at metadata.

Supported model-maturity states:

- evidence-based score;
- provisional evidence-informed score;
- presence only;
- insufficient evidence.

The architecture supports all 37 species. The audit now has 22 modelable rules
covering 17 species: two unusually direct production candidates and twenty
evidence-informed candidates. Each has a tested range, confidence, conservative
cap tier, missing-data behavior, and double-counting guard. Additional species
can be promoted without changing the scoring engine.

Status: `candidate-v0.2.0` now supplies one isolated fixture per modelable rule,
with source records, scope gates, neutral fallbacks, correlation groups, and
explicit production-import blocks. This completes the configuration and golden
scenario foundation, not production approval. A separate readiness gate blocks
observation intake until evaluation metrics, sample-size rationale, holdouts,
and exclusions are preregistered.

## Milestone 6 - standardize environmental snapshots

Create one environmental snapshot contract for every spot and selected time.

Potential inputs:

- air temperature and recent trend;
- observed or estimated water temperature and uncertainty;
- water-temperature trend;
- barometric pressure and trend when a species rule supports it;
- cloud cover, precipitation, and wind;
- sunrise, sunset, solar position, and underwater-light proxy;
- streamflow, flow percentile, and rate of change;
- tidal stage and current;
- recent stocking;
- waterbody type;
- dissolved oxygen and turbidity when genuinely available;
- modeled regional spawning phase.

Every input must carry one provenance state:

- observed;
- forecast;
- modeled from forecast;
- estimated from historical conditions;
- unavailable.

Water-temperature estimates must include uncertainty. If the plausible range
materially changes the activity result, the score must report lower confidence
instead of displaying false precision.

## Milestone 7 - implement forecast capabilities and timeline limits

Before displaying a timeline, calculate the available forecast window for the
selected spot or map region.

The capability response should include:

- hourly forecast start and final supported timestamp;
- daily forecast start and final supported date;
- generation and freshness timestamps;
- inputs available at each resolution;
- modeled inputs;
- unavailable or stale inputs;
- whether any missing input prevents scoring or merely lowers confidence.

Timeline rules:

- hourly scrubbing ends at the final supported hourly timestamp;
- daily outlooks continue only through the final supported daily forecast;
- unsupported future dates are disabled;
- forecast horizons are calculated dynamically rather than assuming seven days;
- modeled water temperature may use forecast weather but may not extend beyond
  the supporting weather forecast;
- daily outlooks exclude rules that require unavailable hourly resolution;
- stale provider data is labeled and reduces confidence;
- missing a required input may shorten the usable horizon, while missing an
  optional input removes only that modifier.

Daily results must be labeled **daily outlook** and must not imply an exact hour.

## Milestone 8 - implement the deterministic scoring engine

The scoring engine must be independent of the UI and must never silently read
the current clock. The selected timestamp is always explicit.

Conceptual interface:

```text
scoreSpecies({
  species,
  spot,
  selectedTime,
  environmentalSnapshot,
  modelVersion
})
```

Each result returns:

- activity score and tier;
- confidence and model maturity;
- applied, skipped, and unavailable rules;
- input values and provenance;
- positive and negative contributions;
- evidence IDs and source IDs;
- warnings and transfer limitations;
- model version.

This interface supports current scoring, hourly forecasts, daily outlooks,
historical replay, backtesting, and fixed regression scenarios.

## Milestone 9 - build the interactive prediction timeline

Add to Explore:

- a prominent **Now** control;
- selected date and time display;
- horizontal hourly scrubber;
- daily-outlook selector after hourly coverage ends;
- visible hourly and daily forecast boundaries;
- observed, forecast, modeled, and unavailable labels;
- shareable date/time URL state;
- accessible keyboard controls and mobile behavior.

Changing the selected time must update together:

- map markers;
- best-biting species at each spot;
- ranked spot list;
- per-species scores;
- score explanations;
- confidence and forecast-resolution labels.

Requests should be debounced or cancelled as the user scrubs so stale responses
cannot repaint the map after a newer selection.

## Milestone 10 - synchronize map markers and rankings

Map markers represent the best supported opportunity at the selected time.

Behavior:

- with no species selected, use the highest supported activity score among
  documented species at the spot;
- with one species selected, color the marker by that species' result;
- with multiple species selected, use the best-scoring selected species present;
- in an **all selected species** mode, require each selected species to have
  qualifying presence evidence;
- insufficient-evidence species remain visible but cannot win through an
  invented score.

Marker fill represents opportunity tier:

- strong;
- good;
- fair;
- slow;
- insufficient data.

The marker icon, abbreviation, or tooltip identifies the species responsible
for the color. The map and ranked list must consume the same backend result.

Example:

```text
Occoquan Reservoir
Best at 6 PM: Channel catfish - 78
Largemouth bass - 64
Bluegill - 58
Confidence: Moderate
```

## Milestone 11 - upgrade spot details

Each spot page should show:

- all documented species present;
- presence-evidence tier and confidence;
- current or selected-time activity for supported species;
- clear "what is biting" and "what is not" states;
- applied score factors and skipped-data limitations;
- water-temperature value, provenance, and confidence;
- access information, directions, and favorites;
- species-specific consumption advisories;
- an optional user-report entry point.

Ordinary spot-level data sources should be consolidated in the **How it works**
source center. A spot may show a concise provenance summary and link to the
relevant source category instead of displaying repetitive citations.

Safety exception: a consumption advisory must include a direct link to the
issuing agency on the applicable spot/species surface.

## Milestone 12 - integrate the research into the Fish Guide

Every species guide should include:

- correct taxonomic family and names;
- identification-grade, license-reviewed imagery;
- identification, habitat, diet, and seasonal behavior;
- spawning behavior;
- supported temperature, oxygen, diel, flow, and clarity findings;
- bait, lure, fly, presentation, and tackle context when supported;
- Northern Virginia relevance;
- conservation, invasive-species, and handling notes;
- model maturity and important research gaps;
- topic-grouped sources.

The main guide remains readable. Citations should live in an expandable or
dedicated Sources section rather than following every sentence.

## Milestone 13 - expand How it works and source documentation

Create a central **Data and sources** area covering:

- fish-community and presence evidence;
- public-access and facility information;
- weather providers;
- water-temperature estimation;
- streamflow, tides, and stocking;
- consumption advisories;
- species behavior and catchability research;
- scoring methodology and evidence tiers;
- model confidence and uncertainty;
- production versus evidence-informed rules;
- known research and data gaps.

Source presentation should be layered:

1. short score explanations identify contributing factors;
2. species pages group citations by scientific topic;
3. How it works contains the full methodology and source registry;
4. internal rule records retain exact evidence/source traceability.

Live provider provenance must remain distinct from scientific behavioral
research. Data Health and manual provider controls remain administrator-only.

## Milestone 14 - validation and alpha hardening

Automated and manual testing must cover:

- canonical schema validation across all 37 species;
- broken source/evidence references and duplicate source identity;
- score bounds, missing inputs, and uncertainty behavior;
- interaction and double-counting protection;
- unit and temperature conversions;
- hourly and daily forecast boundaries;
- hourly-to-daily transitions;
- time zones, sunrise/sunset, and daylight-saving changes;
- water-temperature uncertainty propagation;
- map/list synchronization during timeline changes;
- filter, favorites, address/ZIP travel, and Google Maps journeys;
- accounts and session persistence;
- advisory filtering and direct safety links;
- mobile, tablet, keyboard, screen-reader, and cross-browser behavior;
- Docker production build and startup.

Create fixed **golden scenarios** for every activated species. Model changes must
not silently alter expected outputs without an intentional model-version update.

Use a feature flag or administrative comparison view to compare the current and
new scoring systems during rollout.

## Milestone 15 - add the alpha feedback loop

Allow testers to optionally report:

- species targeted and caught;
- approximate time and effort;
- general bite activity;
- bait, lure, or fly;
- observed water temperature or clarity;
- catch/release outcome.

User reports initially validate the model. They must not automatically retrain,
calibrate, or rewrite production scores. Administrative tools can compare
predicted activity with reports while preserving privacy and unsuccessful trips.

## Recommended execution order

1. Finish and audit Batches 10-11.
2. Consolidate and normalize the full research library.
3. Complete the model-translation audit.
4. Select the initial production species cohort.
5. Create versioned species model configurations.
6. Standardize environmental snapshots and forecast capabilities.
7. Implement the deterministic scoring engine and golden tests.
8. Add hourly and daily prediction scrubbing.
9. Synchronize map markers, rankings, and multi-species behavior.
10. Upgrade spot details and consumption-advisory handling.
11. Integrate research and topic-grouped citations into the Fish Guide.
12. Build the How it works source center.
13. Run full alpha hardening and Docker deployment checks.
14. Begin limited friend testing and collect validation feedback.

## Short-term definition of done

The short-term plan is complete when:

- all 37 species are present in one normalized evidence library;
- every candidate rule has a documented implementation disposition;
- an initial evidence-qualified species cohort receives versioned activity
  scores with explanation traces;
- other species remain honestly labeled as provisional, presence-only, or
  insufficient evidence;
- hourly scrubbing stops at hourly forecast coverage and daily outlooks stop at
  daily coverage;
- modeled inputs are labeled and uncertainty affects confidence;
- the selected timeline state updates map colors, winning species, rankings,
  and explanations consistently;
- ordinary spot provenance is consolidated in How it works, while consumption
  warnings link directly to the issuing agency;
- Fish Guide sources are available without cluttering ordinary reading;
- accounts, favorites, directions, filters, and administrator-only data health
  continue to work;
- automated tests and the production Docker build pass;
- the alpha is suitable for limited external testing.

## Explicitly deferred

- machine-learning personalization;
- forecasts beyond provider coverage;
- automatically changing model weights from user reports;
- pretending all species have equal research maturity;
- public social feeds, leaderboards, or catch sharing;
- native mobile applications;
- broader geographic expansion until the Northern Virginia foundation is
  operationally reliable.
