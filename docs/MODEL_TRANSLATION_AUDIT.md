# Model-translation audit

Snapshot date: 2026-07-16
Scope: all 61 imported score candidates
Production scoring changes: **none**

## Outcome

Every imported score candidate now has exactly one written disposition. The
review accepts research on the correct species when it measures feeding,
foraging, activity, or catchability under conditions BiteMap can supply or
defensibly model. Geography, life stage, and laboratory versus field setting
control confidence and effect size rather than automatically disqualifying a
rule.

| Disposition | Rules | Meaning |
| --- | ---: | --- |
| Production candidate | 2 | Direct endpoint and usable input, but still blocked pending human source sign-off, curve review, tests, and validation. |
| Evidence-informed candidate | 20 | Correct-species, relevant-endpoint evidence with bounded confidence and effect caps. |
| Deferred latent input | 26 | Potentially useful later, but the required state is not being inferred in this pass. |
| Context only | 8 | Useful biology or interpretation, but not a portable bite endpoint. |
| Zero weight | 5 | Duplicate, too confounded, contradictory, or too small for an independent contribution. |

Production-approved rules: **0**. Live-scorer-eligible rules: **0**.

The 22 modelable rules cover 17 species. Each now has an input contract, tested
range, model confidence, curve family, conservative cap tier, neutral
missing-data behavior, double-counting guard, and validation requirements.
These are model blueprints, not live weights.

## Initial source-preflight cohort

Six rules received an independent primary-source preflight. This is a
validation cohort, not a release cohort.

| Species and signal | Disposition | Main restriction |
| --- | --- | --- |
| Northern snakehead daylight/morning | Production candidate | Tidal Potomac, May-June, minor contribution only. |
| Walleye dawn/dusk and solar light | Production candidate | Lake/reservoir scope; one latent light signal to prevent double counting. |
| American eel post-sunset/nocturnal activity | Evidence-informed | Baited traps in a turbid estuary; setting reduces the contribution rather than erasing it. |
| Channel catfish seasonal cooling | Evidence-informed | Field and aquaculture evidence supports direction; temperature anchors replace a generic seasonal penalty. |
| Channel catfish 31-35 C heat stress | Evidence-informed | Juvenile aquaculture evidence supports a severe-heat guardrail. |
| Common carp temperature response | Evidence-informed | Controlled feeding anchors support a bounded thermal shape. |

The blacknose-dace full text now confirms a primary 16:00-20:00 peak and a
smaller 04:00-08:00 increase during the July study. The fallfish official
abstract confirms a distinct peak but does not identify its interval; no public
primary full text was located. Blacknose dace therefore has a conservative
test-only response, while fallfish remains explicitly blocked and neutral.

## Why 26 relevant rules remain deferred

The deferred classification does not mean the research is inaccurate. It means
the app is not yet estimating that hidden condition in this implementation
pass. Examples include:

- individual fish size or age;
- recent capture, angling pressure, or social-exposure history;
- confirmed active nest guarding rather than a calendar spawn estimate;
- exact population or strain;
- recent stocking event time rather than a static stocked-water flag;
- underwater illuminance rather than surface daylight;
- suspended sediment in mg/L rather than turbidity in FNU or NTU;
- nightly minimum, percent saturation, or multi-week dissolved-oxygen exposure
  rather than a single point reading;
- chronic thermal acclimation rather than the current estimated temperature.

Several can later become probabilistic inputs—especially chronic temperature,
reproductive phase, stocking recency, underwater light, population size
distributions, and oxygen history. They remain in the ledger so that work can
resume without repeating the research.

## Conservative engineering caps

The candidate blueprint defines four maximum contribution envelopes:

| Tier | Multiplier envelope | Intended use |
| --- | --- | --- |
| Minor | 0.97-1.03 | Narrow, weak, or incompletely verified signal. |
| Moderate | 0.95-1.05 | Direct direction with meaningful setting uncertainty. |
| Strong conservative | 0.92-1.08 | Comparatively strong evidence pending validation. |
| Severe stress | 0.85-1.00 | Exact extreme physiological conditions only. |

These are engineering ceilings, not published study effect sizes. Temperature
and diel blueprints calibrate or replace the existing species factor instead of
stacking a second correlated multiplier. Severe weather, cloud, flow, rain,
turbidity, solar radiation, and temperature trend likewise cannot be counted
twice through different labels.

## Reproducible artifacts

The reviewed decisions live in
`research/species/model-review/decisions.json`; bounded model definitions live
in `research/species/model-review/candidate-blueprints.json`. Running the audit
generates:

- `model-review-ledger.json` - all 61 rules, rationales, source status, runtime
  status, approval status, and next action;
- `initial-validation-cohort.json` - the six source-preflighted rules and their
  restrictions;
- `validation-report.json` - assignment, schema, and production-gate checks.

The separate candidate-fixture pipeline generates:

- `candidate-model-fixtures.json` - 22 versioned, non-production definitions;
- `golden-scenarios.json` - 194 fixed range, gate, missing-input, interpolation,
  and correlation scenarios;
- `fixture-validation-report.json` - cap, ordering, isolation, and scenario
  checks.

An adversarial engineering review then produced `candidate-v0.2.0`. Six curves
were reduced even though they already fit their formal caps: American eel,
brown-bullhead very-cold response, channel-catfish cold response,
northern-snakehead diel response, white-sucker temperature response, and
yellow-perch diel response. This review is explicitly AI-assisted and records
neither human nor production approval.

The future comparison cohort contains only two rules: local tidal-Potomac
northern-snakehead diel activity and walleye diel angling success. The
validation-readiness gate currently reports zero independent observations and
blocks both live shadowing and production use.

Run:

```powershell
node scripts/run-model-review-audit.mjs
npm run audit:model-review
node scripts/run-candidate-model-fixtures.mjs
npm run audit:candidate-models
node scripts/run-candidate-validation-gate.mjs
npm run audit:candidate-validation
```

The outputs are stored under `research/species/model-review/generated`, outside
all production-scoring data paths. The audit rejects duplicate or missing rule
assignments and requires all 22 modelable rules to have a complete bounded
blueprint. Even then, live-scorer eligibility remains false.

## Next gate

Preregister the comparison metrics, precision/sample-size rationale,
time/waterbody holdouts, exclusion rules, and minimum acceptable improvement.
Then collect prospective targeted effort and catch/no-catch observations for
the two-rule cohort. Only after held-out results and named human sign-off should
a feature-flagged live comparison be built; production continues to ignore all
candidate artifacts.
