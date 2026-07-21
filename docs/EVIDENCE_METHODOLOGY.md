# BiteMap NOVA — Fish Evidence Methodology & Design Decisions

This document explains **how BiteMap decides which fish to show at each water, and
why** — so the reasoning behind the evidence tiers and sourcing rules is written down
and doesn't have to be reverse-engineered later.

## Core principle

Every species shown at a water traces to **a real agency source, or a clearly-labeled
inference grounded in real data** — never a stereotype and never a fabricated claim.
"No documented fishery" is an honest, acceptable answer; a made-up fish is not.

---

## Evidence tiers (assembled strongest → weakest)

`app/lib/data.ts` builds each water's species list by layering the tiers below. Each
layer only adds species not already present, and **every layer passes through the
evidence-rejection ledger** (`evidenceAllowed()` / `evidence-rejections.json`), so a
reviewer-removed (location, species, source) triple can never reappear.

| # | Tier | What it is | Modeled? | Source artifact |
|---|------|------------|----------|-----------------|
| 1 | **Curated + promoted** | Hand-authored + review-approved DWR/NPS/DCR/county survey & listing records | no | `location.evidence`, `promoted-evidence-nova.json` |
| 2 | **Waterbody listing** | DWR waterbody-page communities for the shared water | no | `waterbody-species-nova.json` |
| 3 | **VDH advisory** | Species-*specific* consumption-advisory restrictions (a restriction documents presence) | no | `advisories.ts` |
| 4 | **Aquatic GAP nearby-reach** | USGS presence records on sampled NHDPlus reaches within 1.75 mi | yes (agency survey) | `aquatic-gap-nova.json` |
| 5 | **Same-waterbody completion** | Species documented at *other* access points on THIS river/reservoir, filled in so one water reads consistently | yes | `waterbody-community-nova.json` |
| 6 | **FCPA watershed-typical** | *(empty Pohick lakes only)* FCPA's "standard mix of bass, sunfish, crappie, carp and catfish" statement, group-mapped | yes | reader in `expanded-coverage.ts` |
| 7 | **Likely-present** | *(empty waters only)* downstream connectivity to a documented water + HUC12 subwatershed GAP records + same-waterbody-name match | yes | `likely-present-nova.json` |
| 8 | **Honest empty** | Nothing qualifies → the water shows "no documented fishery" | — | — |

Tiers 1–4 are "documented." Tiers 5–7 are honest, cited inference, flagged `modeled`
in the UI. Modeled tiers do **not** require per-point review approval (they're
inferences, not new direct claims), which is why they're `evidenceType: "modeled"`.

---

## Sourcing rules

- **Agency / official citations only** for real evidence: Virginia DWR, NPS
  (Shenandoah), Virginia DCR, county governments (`*.gov`), USGS, EPA, VDH.
- **Crowd-sourced sites are forbidden as citations** — Fishbrain, FishAngler, forums,
  Reddit, Yelp, etc. They may be used as a *triage signal* ("dig harder here"), never
  cited. Rationale: unreliable location/species tagging + terms-of-service. See
  "Sources we tested and rejected" below.
- **Exact-water**: a species must be documented in *that* water, not borrowed from a
  nearby water or a regional generalization ("lakes in this watershed hold bass…").
- **Verbatim**: every promoted claim carries a verbatim quote + the exact source URL.

---

## The promotion pipeline (candidate → verified → visible)

Agency data is ingested as **candidates**, adversarially reviewed, and only then
**promoted** into visible evidence:

1. **Ingest** — structured feeds (`dwr-fish-habitats-nova.json` wild-trout/anadromous,
   `vafwis-fish-observations-nova.json` 11.5k DWR observations, stocked trout, Aquatic
   GAP) plus per-water web research.
2. **Review** — `docs/data/fish-community-verdicts.json` records the approval decision
   for each candidate (by objectId, by source+species, or a manual claim). Rejected
   claims go to `evidence-rejections.json`. `scripts/build-fish-community-review.mts
   --check` fails the build if any direct claim is live but unreviewed.
3. **Promote** — `scripts/build-promoted-evidence.mjs` emits evidence **only** for
   approved candidates, honoring the rejection ledger, into `promoted-evidence-nova.json`.
4. **Assemble** — `data.ts` layers it (above), then `export-seed.mts` → `seed_export.json`
   → the FastAPI loader/DB.

Because a promoted claim always corresponds to an approved candidate, the review
`--check` recognises it as corroborated and stays green.

---

## Key decisions and their rationale

- **Retired the county/basin stereotype.** It stamped species onto ~122 waters from a
  county→species lookup table — fabrication. Replaced by tier 7 (likely-present),
  which is dataset-driven and cited. This corrected real errors (most small Fairfax/PW
  creeks are largemouth/panfish waters, not the smallmouth the guess asserted).
- **VAFWIS review criterion** = exact-named-water **and** exact-taxon match in DWR's
  own collection database, confidence scaled by recency band, always dated. Applied
  consistently across all 252 waters — that consistent, transparent rule *is* the review.
- **Same-waterbody completion (tier 5).** Access points on one river carried only the
  species documented at their exact point, so e.g. Shenandoah ramps showed smallmouth
  but not the channel catfish documented elsewhere on the same river (a "catfish
  advisory but no catfish" mismatch). One connected water now reads consistently.
- **Seasonal anadromous runs.** Striped bass / herring / shad run up tidal tributaries
  only to spawn. Their evidence carries a run-month window; the scorer **gates
  availability to ~20% outside the run window** (collapses off-season, high in-season)
  and the UI badges them "Seasonal run · in/out of season now." Schema: the
  `seasonal {months,label}` column on `species_evidence` (migration 0004).
- **FCPA watershed-typical (tier 6).** Some county lakes have no lake-specific survey
  anywhere. FCPA's "Parks with Small Lakes" page describes the *Pohick Watershed lakes*
  as holding "a standard mix of bass, sunfish, crappie, carp and catfish." That real
  agency statement is surfaced — group-mapped to the standard species, `modeled`, and
  explicitly labeled watershed-typical (not a lake survey) — **only** for the Pohick
  lakes it actually covers. Royal Lake is excluded (its record is a fish-*save* that
  relocated fish *out*).

## Sources we tested and rejected

- **Fishbrain / crowd apps** — triage signal only, never cited (see rules above).
- **GBIF / iNaturalist** — a legitimate, citable dataset and it *does* hold NoVa fish
  records (~2.5k sunfish), but a per-water check found **0 of 8** sampled waters have a
  record within ~1 km, and none at the target county lakes. It doesn't align with our
  waters, so it is **not** ingested. (Re-test if iNaturalist density grows.)

## Research workflow (token-aware)

Deterministic data (DWR/USGS/NPS ArcGIS, GBIF) is pulled directly in scripts.
Open-web per-water research is **offloaded to a free/cheap AI** via a strict
agency-only prompt (`scratchpad/RESEARCH_PROMPT.md` is the template); the returned
sources are then **judged and integrated** here (authoritative-domain check +
exact-water + verbatim), promoted through the manual-claim verdict path.

## Exact-water is a SPATIAL test, not a name test (critical)

DWR's VAFWIS `Species_Observations_All_Distrib` and the TroutApp wild-trout layer are
keyed by **waterbody *name*, which collides statewide**. A `WHERE UPPER(Waterbody)='X'`
query returns every same-named stream in Virginia with **no geometry** to tell them
apart. Judging a name-match as "our water" is the single most common way bad data slips
in. Two real examples caught this way:

- Batch 2's *"VERIFIED"* rows for Cabin Run, Rocky Run, Moody Creek and Little Creek were
  all name-collisions — the nearest same-named DWR record sat **48–133 mi** from our
  seed coordinate. None were our water. All rejected.
- Batch 1's Tims River brook trout was real, but only confirmable *because* the DWR
  reach at that coordinate carries the **legacy name "Negro Run."**

So the confirmation rule is **by location, against the seed coordinate**:

1. The layer geometry is **NAD83 / UTM 17N (wkid 26917, metres)**. Query with a small
   `esriGeometryEnvelope` around the seed lat/lon, `inSR=4326` (the server reprojects),
   `spatialRel=esriSpatialRelIntersects`; or pull geometry `outSR=4326` and run
   point-in-polygon + haversine yourself. **Beware large multipart features** (e.g. the
   Potomac River polygon "intersects" boxes ~10 mi away) — always confirm the true
   vertex distance, don't trust the intersects flag alone.
2. **Accept** a record only if it sits essentially *on* our water: a reach/obs whose name
   *is* our stream or its DWR abbreviation at ≤~0.15 mi (e.g. South Fork Dry Run ⇒
   `"Dry Run, SF"` 07DSF @ 0.02 mi), **or** a blank-name obs at ≤~0.1 mi with no other
   named stream comparably close (e.g. Keyser Run brook trout @ 0.07 mi).
3. **Reject** when the nearest record is a *different named neighbour* the box merely
   caught (Rocky Run ⇒ Broad Hollow Run @ 0.61 mi; Cabin Run ⇒ Passage Creek @ 1.07 mi;
   Wilson Run ⇒ "Staunton Run" @ 0.32 mi) — borrowing those is the stereotype error in
   disguise. The water stays honestly empty until a stream-specific record exists.

This same spatial sweep *also* fills empties honestly: run every empty water's coordinate
against the VAFWIS + TroutApp layers by **location, ignoring name**, to surface
legacy-name records the name query would miss. Batch 2's real yield came entirely from
this sweep: brook trout at **South Fork Dry Run** (07DSF) and **Keyser Run**, and
brook/brown/rainbow trout at **Woodstock Reservoir** (impoundment on Little Stony Creek,
Class II 07LSC) — all via the manual-claim verdict path.

---

## Generators (each committed artifact → its script)

| Artifact | Script |
|---|---|
| `aquatic-gap-nova.json`, `dwr-trout-nova.json` | `apps/api/app/ingestion/public_data.py` |
| `likely-present-nova.json` | `scripts/generate-likely-present.mjs` (USGS NLDI + GAP HUC12) |
| `waterbody-community-nova.json` | `scripts/build-waterbody-community.mjs` |
| `promoted-evidence-nova.json` | `scripts/build-promoted-evidence.mjs` |
| VAFWIS approvals in verdicts | `scripts/review-vafwis-observations.mjs` |
| `fish-community-review-nova.json` + `--check` | `scripts/build-fish-community-review.mts` |
| the seed | `scripts/export-seed.mts` |

## Standing data priorities

Three things are always in progress (see also the project memory): **(1)** fill every
empty water from real sources, **(2)** ensure all public-access waters in the region
are present, **(3)** per-water audit so each water's species are correct and none are
overlooked.

**Coverage state (2026-07-18):** 213 / 252 waters carry evidence; **39 honestly empty**. The
remainder are mostly small SNP/GWNF mountain streams whose only records are non-game or
in NPS survey PDFs (Wilson Run, Cabin Run, Rocky Run, Phils Arm/Sloan/Moody), a few tidal
creeks with only a Mummichog record (Chotank Creek — not registered as a target), and a
handful of small county lakes with no lake-specific survey anywhere. These need
NPS/county-PDF research (the offload-and-judge lane), not another DWR-layer pass.
