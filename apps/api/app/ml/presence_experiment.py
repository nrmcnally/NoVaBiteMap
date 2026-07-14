"""Species-presence experiment boundary.

Training is deliberately not executed as part of the API. The experiment uses
watershed-grouped and spatial holdouts; neighboring connected reaches must not
cross train/test folds. See docs/MODEL_CARD.md.
"""

BASELINE_MODEL = "regularized-logistic-regression"
CHALLENGER_MODEL = "histogram-gradient-boosting"
VALIDATION_GROUP = "huc8_watershed"

