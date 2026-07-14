import type { FishingLocation, SpeciesEvidence } from "./data";

export type Opportunity = {
  score: number;
  confidence: number;
  confidenceLabel: "High" | "Moderate" | "Low";
  availability: number;
  quality: number | null;
  activity: number;
  accessFit: number;
  evidence: SpeciesEvidence;
};

export function opportunityFor(
  location: FishingLocation,
  speciesId: string,
): Opportunity | null {
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

export function estimatedHourlyScores(base: number) {
  const offsets = [-3, 2, 5, 1, -5, -9, -12, -14];
  const labels = ["5a", "6a", "7a", "8a", "9a", "10a", "11a", "12p"];
  return labels.map((label, index) => ({
    label,
    score: Math.max(0, Math.min(100, base + offsets[index])),
  }));
}

