# Private trip logs and model calibration

Last updated: 2026-07-16

## Product decision

BiteMap records a completed fishing trip rather than starting a timer or
freezing the forecast currently visible in the app. The angler supplies:

- the named BiteMap public-access spot;
- the target species;
- actual start and end date/time;
- angler count and target-species catch count, including an explicit zero;
- optional sub-location description, lure or bait, measured water temperature,
  water clarity, and private notes.

This keeps the entry flow useful even when the angler logs the trip later. The
spot is stored by its BiteMap ID; the form does not collect a private GPS trace.
Each user can list and delete only their own records. Account deletion removes
their trip records as well.

## Privacy and consent

Trip logs are private account data by default. A separate checkbox permits
de-identified aggregate analysis of spot, time, target, effort, catch count,
and structured field observations. Email, display name, and free-text notes are
not included in that consent.

The database keeps the consent decision with each row. Consent plus at least 15
minutes of effort makes a row eligible for the exploratory calibration pool.
It does not make the row eligible for formal validation.

## Why the app does not freeze a forecast

Freezing the forecast makes the logger feel like a start-trip workflow and
ties the scientific record to whichever provider response happened to load.
Instead, BiteMap preserves the factual trip coordinates in time and catalog:
named spot, start, end, target, and outcome.

A separate, user-triggered enrichment step now reconstructs relevant conditions
from independent, time-indexed sources. It receives only the BiteMap location ID
and the trip's start and end timestamps. It cannot inspect catch count, target
species, lure, notes, consent, or user identity when selecting or summarizing
inputs. The resulting replay carries source timestamps, retrieval timestamps,
explicit missing inputs, and the replay-policy version.

The current `historical-replay-v0.1.0` policy uses:

- Open-Meteo's modeled recent-past or Historical Forecast data, with modeled
  reanalysis as an explicitly labeled fallback;
- instantaneous USGS values only where BiteMap already has a manually verified
  location-to-station relationship;
- deterministic solar elevation and phase from the recorded time and public
  access-point coordinates.

Modeled weather is not presented as a station observation or as the forecast
that BiteMap happened to display before the trip. USGS data retains the station
relationship and its reach-specific limitations; an unmapped spot remains
unmapped instead of receiving a proximity guess. Provider failure remains
visible. Solar geometry does not account for shade, terrain, or cloud cover.

The USGS Instantaneous Values adapter currently uses WaterServices. USGS has
announced that this legacy service will be decommissioned in early 2027, so the
adapter must move to the replacement Water Data APIs before then.

## Calibration is not validation

Private alpha trip logs support instrumentation checks and exploratory model
calibration. They do not prove predictive validity. The formal validation store
remains separate and empty.

Before any row can enter confirmatory evaluation:

1. A named human reviewer must sign the model version, fixture hash, metrics,
   exclusions, and analysis plan.
2. The condition-replay policy and archive sources must be fixed.
3. Whole-waterbody and future-date holdouts must be declared without examining
   held-out catches by score stratum.
4. Every observation must include effort and an explicit zero when no target
   fish was caught.
5. Missing required model inputs must exclude the row rather than trigger an
   invented value.

The current draft uses target catch per angler-hour as the primary outcome,
with zero-catch rate, catch occurrence, calibration, and held-out comparison to
the current baseline as secondary outcomes. The first 30 consented trips per
cohort species are an outcome-blinded instrumentation pilot, not a success
claim. The locked comparison cohort remains northern snakehead and walleye.

## Current implementation boundary

Implemented now:

- authenticated create/list/delete trip APIs for PostgreSQL and hosted D1;
- timestamp, location/species evidence, duration, and value validation;
- private-by-default UI and per-row aggregate-analysis consent;
- database migrations and account-deletion cleanup;
- on-demand, outcome-blind weather, mapped-USGS, and solar reconstruction;
- per-provider coverage, limitation, replay-policy, and retrieval metadata;
- a hard `validation_eligible = false` gate.

Not implemented yet:

- observed or modeled historical water temperature where a USGS temperature
  series is not available;
- duplicate and suspicious-pattern review tooling;
- de-identified analyst export;
- human preregistration approval;
- held-out evaluation or production candidate activation.
