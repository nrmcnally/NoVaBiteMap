import type { CanonicalOpportunity, FishingLocation } from "./data";
import { buildForecast, type NwsAlert, type NwsForecastPeriod } from "./forecast";
import { profileFor } from "./species-profiles";

export type Opportunity = CanonicalOpportunity;

export type ForecastedOpportunity = {
  opportunity: Opportunity;
  period: NwsForecastPeriod;
  factors: {
    timeOfDay: number;
    wind: number;
    precipitation: number;
  };
};

export function opportunityFor(
  location: FishingLocation,
  speciesId: string,
): Opportunity | null {
  const canonical = location.opportunities?.[speciesId];
  if (canonical) return canonical;
  // Never silently recompute a different score for a canonical API row. If the
  // backend did not offer this species, it did not clear the evidence gate.
  if (location.runtimeSource === "canonical-api") return null;

  const evidence = location.evidence.find((item) => item.speciesId === speciesId);
  if (!evidence || evidence.availability < 0.35) return null;

  const qualityForFormula = evidence.quality ?? 0.5;
  const weightedConditions =
    0.35 * qualityForFormula +
    0.5 * location.activityEstimate +
    0.15 * location.accessFit;
  const score = Math.round(
    100 * Math.pow(evidence.availability, 1.5) * weightedConditions,
  );

  const qualityCoverage = evidence.quality === null ? 0.58 : 0.86;
  const liveConditionFactor = 0.72;
  const confidence = Math.round(
    100 *
      (0.45 * evidence.evidenceConfidence +
        0.3 * qualityCoverage +
        0.25 * liveConditionFactor),
  );

  return {
    score,
    confidence,
    confidenceLabel:
      confidence >= 75 ? "High" : confidence >= 50 ? "Moderate" : "Low",
    availability: evidence.availability,
    quality: evidence.quality,
    activity: location.activityEstimate,
    accessFit: location.accessFit,
    evidence,
  };
}

export function opportunityForForecast(
  base: Opportunity,
  speciesId: string,
  periods: NwsForecastPeriod[],
  alerts: NwsAlert[] = [],
): ForecastedOpportunity | null {
  if (periods.length === 0) return null;
  const profile = profileFor(speciesId);
  const forecast = buildForecast({
    periods,
    alerts,
    availability: base.availability,
    quality: base.quality,
    accessFit: base.accessFit,
    baseConfidence: base.confidence,
    associationFactor: 1,
    hydrologyRelevant: false,
    dielPattern: profile?.dielPattern,
    seasonalActivityByMonth: profile?.seasonalActivityByMonth,
  });
  const best = [...forecast.hourly].sort((a, b) => b.score - a.score)[0];
  if (!best) return null;
  return {
    opportunity: {
      ...base,
      score: best.score,
      activity: best.activity,
    },
    period: {
      startTime: best.startTime,
      temperature: best.temperature,
      temperatureUnit: best.temperatureUnit,
      shortForecast: best.shortForecast,
      windSpeed: best.windSpeed,
      windDirection: best.windDirection,
      windGust: best.windGust,
      isDaytime: best.isDaytime,
      precipitationProbability: best.precipitationProbability,
    },
    factors: best.factors,
  };
}

export function estimatedHourlyScores(base: number) {
  const offsets = [-3, 2, 5, 1, -5, -9, -12, -14];
  const labels = ["5a", "6a", "7a", "8a", "9a", "10a", "11a", "12p"];
  return labels.map((label, index) => ({
    label,
    score: Math.max(0, Math.min(100, base + offsets[index])),
  }));
}
