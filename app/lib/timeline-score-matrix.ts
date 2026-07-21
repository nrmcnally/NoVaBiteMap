import type { CanonicalOpportunity } from "./data";
import type { NwsAlert, NwsForecastPeriod } from "./forecast";
import type { ForecastSelection } from "./prediction-timeline";

export type TimelineSpeciesScores = {
  baseScore: number;
  confidence: number;
  confidenceLabel: "High" | "Moderate" | "Low";
  hourlyScores: number[];
  dailyScores: Array<number | null>;
  dailyBestPeriodIndexes: Array<number | null>;
};

export type TimelineScoreMatrix = {
  contractVersion: "timeline-score-matrix-v0.1.0";
  engine: "canonical-api" | "bundled-fallback";
  provider: string;
  retrievedAt?: string;
  forecastUpdatedAt?: string;
  anchor: { lat: number; lng: number; label: string };
  basis: string;
  periods: NwsForecastPeriod[];
  alerts: NwsAlert[];
  dayKeys: string[];
  locations: Record<string, Record<string, TimelineSpeciesScores>>;
};

export type SelectedMatrixScore = {
  opportunity: CanonicalOpportunity;
  period: NwsForecastPeriod;
};

export type MatrixScoreValue = {
  score: number;
  period: NwsForecastPeriod;
};

export function matrixScoreKey(locationId: string, speciesId: string) {
  return `${locationId}\u0000${speciesId}`;
}

export function selectedScoresFromMatrix(
  matrix: TimelineScoreMatrix | undefined,
  selection: ForecastSelection | null,
) {
  const selected = new Map<string, MatrixScoreValue>();
  if (!matrix || !selection) return selected;

  const hourlyIndex = selection.mode === "hourly"
    ? matrix.periods.findIndex((period) => period.startTime === selection.key)
    : -1;
  const dayIndex = selection.mode === "daily"
    ? matrix.dayKeys.indexOf(selection.key)
    : -1;

  for (const [locationId, speciesScores] of Object.entries(matrix.locations)) {
    for (const [speciesId, scores] of Object.entries(speciesScores)) {
      const periodIndex = selection.mode === "hourly"
        ? hourlyIndex
        : dayIndex >= 0 ? (scores.dailyBestPeriodIndexes[dayIndex] ?? -1) : -1;
      const score = selection.mode === "hourly"
        ? scores.hourlyScores[periodIndex]
        : dayIndex >= 0 ? scores.dailyScores[dayIndex] : undefined;
      const period = periodIndex >= 0 ? matrix.periods[periodIndex] : undefined;
      if (typeof score !== "number" || !period) continue;
      selected.set(matrixScoreKey(locationId, speciesId), {
        score,
        period,
      });
    }
  }
  return selected;
}

export function scoreFromMatrix(
  matrix: TimelineScoreMatrix | undefined,
  locationId: string,
  speciesId: string,
  selection: ForecastSelection | null,
  base: CanonicalOpportunity,
): SelectedMatrixScore | null {
  const value = selectedScoresFromMatrix(matrix, selection).get(matrixScoreKey(locationId, speciesId));
  if (!value) return null;
  return {
    opportunity: {
      ...base,
      score: value.score,
    },
    period: value.period,
  };
}
