# BiteMap NOVA scoring profile v1.0 — model card

## Intended use

Rank relative freshwater fishing opportunities by species, place, time, access,
and confidence. The score helps anglers compare options. It is not a catch
probability, a guarantee, or a substitute for regulations and safety guidance.

## Components

1. Species availability: weighted authoritative evidence and valid absence.
2. Long-term fishery quality: comparable method-specific metrics and ratings.
3. Hourly activity: species-configured suitability curves for available inputs.
4. Access fit: whether the chosen fishing method is supported.
5. Confidence: coverage, recency, authority, agreement, directness, horizon,
   and hydrologic association—reported separately.

Formula: `100 × availability^1.5 × (0.35×quality + 0.50×activity + 0.15×access)`.
Safety caps apply after the formula. Missing quality or activity uses a neutral
0.5 only for score continuity and applies a visible confidence penalty.

## Evidence and validation state

Phase 1 is deterministic and transparent. It has not been calibrated against
angler catch probability. Unit tests cover evidence conflicts, modeled-only
caps, missing inputs, safety gates, confidence horizon, and the rule that strong
weather cannot override weak species presence.

## First ML experiment

The first legitimate ML target is reach/waterbody species presence, not hourly
catch success. Baseline is regularized logistic regression; challenger is
histogram gradient boosting. Validation groups by watershed, includes spatial
and time-aware holdouts, and prevents connected neighboring reaches from
straddling train and test. Required metrics are ROC-AUC, precision, recall, F1,
Brier score, calibration, Virginia performance, held-out watersheds, and
data-poor subsets. A model is not deployed for a species without adequate sample
size and validation quality.

## Limitations

Agency surveys do not equal angler catch rates. Broad waterbody evidence can
miss reach variation. Forecasts change. Water temperature may be estimated.
Gages may not be representative. Aquatic GAP is landscape-scale modeled
evidence and is intentionally capped without direct support.

