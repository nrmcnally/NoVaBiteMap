# Species research workspace

This directory is the non-production intake and normalization area for the
deep species research. The live BiteMap scorer does not read these files yet.

## Layout

```text
research/species/
  raw/archives/        Immutable research ZIPs as received
  schema/              Draft canonical JSON Schema
  config/              Reviewed normalization overrides
  generated/           Deterministic pipeline output
  model-review/        Isolated dispositions, candidate fixtures, and audits
```

The raw archives must not be edited in place. Corrections belong in
`config/source-overrides.json` so the original metadata and the reviewed change
remain auditable.

Run the pipeline from the repository root:

```powershell
python scripts/species_research_pipeline.py
python scripts/species_research_pipeline.py --check
npm run audit:species-research
```

Generated artifacts:

- `archive-manifest.json` - archive checksums and imported batch coverage
- `species-research.json` - normalized species summaries and topic findings
- `source-registry.json` - globally deduplicated source registry
- `evidence-library.json` - normalized, source-linked evidence ledger
- `model-translation-queue.json` - candidate rules awaiting scientific review
- `runtime-input-matrix.json` - model inputs and current data availability
- `coverage-matrix.json` - evidence/model coverage by species
- `validation-report.json` - importer errors, warnings, and schema drift

All imported claims remain `AI-reviewed-unverified` unless a separate human
review is explicitly recorded. A source appearing in this workspace does not
mean its candidate model rule is approved for production.

Run the separate, non-production model review audit after regenerating the
canonical research library:

```powershell
node scripts/run-model-review-audit.mjs
npm run audit:model-review
```

Its decision ledger covers all 61 score candidates and is stored under
`model-review/generated`, outside production scoring paths. See
`docs/MODEL_TRANSLATION_AUDIT.md` for the current dispositions and next gate.
The manually reviewed `model-review/candidate-blueprints.json` defines bounded
non-production translations for the 22 currently modelable rules. The separate
`candidate-fixture-specs.json` converts them into versioned test-only curves:

```powershell
node scripts/run-candidate-model-fixtures.mjs
npm run audit:candidate-models
```

The generated `candidate-v0.2.0` fixtures and 194 golden scenarios are stored below
`model-review/generated/candidate-fixtures`. Twenty-one fixtures can run in the
isolated evaluator; fallfish remains blocked and neutral because its exact peak
interval is not available in the official abstract. None are importable by the
live scorer.

Run the separate validation-readiness gate after rebuilding the fixtures:

```powershell
node scripts/run-candidate-validation-gate.mjs
npm run audit:candidate-validation
```

The adversarial review covers all 22 curves, records six conservative magnitude
reductions, and selects only the snakehead and walleye diel rules for future
offline comparison. The prospective observation store is intentionally empty;
the audit blocks observation intake until metrics, sample-size rationale, and
time/waterbody holdouts are preregistered.

## Current intake snapshot

The generated snapshot covers numbered research batches 1-11 plus the deeper
standalone pilot archives for largemouth bass, smallmouth bass, and channel
catfish. Together they account for all 37 planned species. See
`REVIEW_GUIDE.md` for the current counts, unresolved warnings, and the approval
gates that must be completed before any rule reaches the live scorer. Rerunning
the pipeline rebuilds every artifact from the raw ZIPs and the reviewed override
ledger.
