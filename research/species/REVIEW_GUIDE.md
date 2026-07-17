# Species research review guide

Snapshot date: 2026-07-16
Included archives: Batches 1-11 plus three deep pilot archives
Production scoring changes from this intake: **none**

This workspace turns the deep-research archives into an auditable review queue.
It does not treat an AI-produced report, a verified citation, or a plausible
mechanism as permission to change BiteMap's live score.

## Current coverage

| Measure | Count |
| --- | ---: |
| Imported archives | 14 |
| Species records | 37 |
| Unique canonical sources | 372 |
| Source occurrences | 397 |
| Evidence records | 532 |
| Candidate rules of all dispositions | 346 |
| Score rules pending scientific review | 61 |
| Score rules with a written first-pass disposition | 61 |
| Production-approved rules | 0 |

Every species report currently describes its research as partial. The imported
recommendations include 17 bite-scored species, 12 proposed scoring species,
and 8 Fish Guide-only species. These are research-package
classifications, not new product decisions.

### Runtime feasibility of the 61 score candidates

| Current input status | Rules | Meaning |
| --- | ---: | --- |
| Available | 12 | BiteMap already has an hourly input with a plausible mapping. |
| Modeled | 26 | BiteMap has an estimated input, most notably water temperature. |
| Conditional | 8 | Availability depends on geography or provider coverage. |
| Unavailable | 15 | The rule requires data not currently available at runtime. |

The unavailable group includes fish size/age, recent capture or social exposure,
local artificial light, population/strain, and prey availability. These rules
must not be silently approximated from unrelated weather variables. Recent
stocking events are also unavailable: BiteMap has designated stocked-water
records, but not current event dates suitable for a same-day modifier.

## Required approval gates

Each score candidate must pass these gates separately:

1. **Source identity** - confirm the citation resolves to the claimed work and
   that author, title, year, and DOI or stable record URL agree.
2. **Claim traceability** - inspect the original text, table, or figure at the
   recorded locator and confirm the normalized claim is faithful.
3. **Endpoint relevance** - distinguish hook-and-line catchability or feeding
   behavior from movement, habitat occupancy, growth, survival, and documented
   evidence gaps.
4. **Transferability** - judge species, life stage, geography, waterbody type,
   season, and experimental-setting differences explicitly.
5. **Model translation** - define a bounded response curve and uncertainty;
   reject unsupported thresholds and avoid double-counting correlated inputs.
6. **Runtime mapping** - prove the required BiteMap input exists at the promised
   location and hourly/daily forecast resolution.
7. **Validation and sign-off** - add adversarial tests, compare behavior against
   known conditions, and record human approval before production integration.

`model-translation-queue.json` is the handoff for gates 3-7. Every score entry
is marked `pending-scientific-review`. `runtime-input-matrix.json` identifies
which candidates can actually be supported by today's data layer.

The deterministic model-translation audit classifies the 61 score candidates as
2 direct production candidates, 20 evidence-informed candidates, 26 deferred
latent-input rules, 8 context-only findings, and 5 zero-weight findings. All 22
modelable rules have bounded non-production blueprints; no review artifact is
read by the live scorer. See `docs/MODEL_TRANSLATION_AUDIT.md`,
`model-review/candidate-blueprints.json`, and
`model-review/generated/model-review-ledger.json`.

## Open intake warnings

The pipeline currently reports 0 errors and 12 warnings. They are retained rather
than hidden:

- Batch 10's manifest counts 18 abstract-only sources, while the normalized
  access records support 14. This appears to be a definition difference and
  needs a human decision.
- Batch 11 similarly reports 12 abstract-only sources while the normalized
  records support 7. Its validation report separately retains 24 byline or
  full-text-access limitations.
- Batches 9, 10, and 11 combine candidate zero-weight rules and separately listed
  zero-weight variables in their manifest totals. The importer preserves both
  meanings.
- Three spotted-bass citations in Batch 7 use SEAFWA search or listing pages
  instead of stable source-record URLs. They are not eligible for production
  use until replaced or verified.
- The largemouth-bass pilot archive has no separate validation report or
  search-breadth audit. Its claims remain in the review queue, not production.
- Source records vary in the type used for `speciesActuallyStudied` and `year`.
  The canonical output normalizes these fields while the raw archives retain the
  originals.

## Intake status and next work

The planned 37-species archive intake is complete. The shallow original
37-species bundle and the superseded unverified channel-catfish draft were
deliberately excluded from canonical input in favor of the deeper replacements.

The blacknose-dace diel passage is now verified from the full-volume scan and
OCR. The official fallfish abstract confirms a distinct peak but does not state
its interval, so that rule is explicitly blocked and neutral rather than
assuming a late-day peak.

All 22 bounded blueprints now have `candidate-v0.2.0` non-production fixtures:
21 runnable test-only definitions and one blocked fallfish definition. The
fixture audit generates 194 deterministic scenarios covering anchors,
interpolation, ranges, missing inputs, scope gates, source blocking, and
correlated-input behavior. An adversarial review reduced six effects whose
formal caps still overstated endpoint, setting, life-stage, or geographic
transfer. It selected only the northern-snakehead and walleye diel rules for a
future offline comparison.

No suitable independent, timestamped effort-and-catch dataset is present. The
validation-readiness report therefore remains blocked with zero observations,
no human approval, and no live-scorer eligibility. Next, preregister metrics,
sample-size/precision targets, holdouts, and exclusions; then collect
prospective targeted trips including zero-catch outcomes. Do not edit the live
scoring profiles until held-out validation and named human sign-off pass.

Corrections to supplied metadata belong in `config/source-overrides.json` with
the original values, revised values, reason, and independent verification URLs.
This keeps the supplied archive immutable and the correction reviewable.
