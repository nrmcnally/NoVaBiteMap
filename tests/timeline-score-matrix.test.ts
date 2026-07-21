import assert from "node:assert/strict";
import test from "node:test";
import type { CanonicalOpportunity } from "../app/lib/data";
import {
  matrixScoreKey,
  scoreFromMatrix,
  selectedScoresFromMatrix,
  type TimelineScoreMatrix,
} from "../app/lib/timeline-score-matrix";

const base: CanonicalOpportunity = {
  score: 54,
  confidence: 72,
  confidenceLabel: "Moderate",
  availability: 0.8,
  quality: 0.65,
  activity: 0.5,
  accessFit: 0.8,
  evidence: {
    speciesId: "largemouth-bass",
    availability: 0.8,
    quality: 0.65,
    evidenceConfidence: 0.78,
    evidenceType: "official listing",
    evidenceSummary: "Test evidence",
    lastEvidence: "2026",
    technique: "",
    depth: "",
    positive: [],
    negative: [],
  },
};

const periods = [
  {
    startTime: "2026-07-18T06:00:00-04:00",
    temperature: 70,
    temperatureUnit: "F",
    shortForecast: "Clear",
    windSpeed: "2 mph",
    windDirection: "W",
    precipitationProbability: 0,
  },
  {
    startTime: "2026-07-18T12:00:00-04:00",
    temperature: 86,
    temperatureUnit: "F",
    shortForecast: "Sunny",
    windSpeed: "8 mph",
    windDirection: "SW",
    precipitationProbability: 5,
  },
];

const matrix: TimelineScoreMatrix = {
  contractVersion: "timeline-score-matrix-v0.1.0",
  engine: "canonical-api",
  provider: "National Weather Service",
  retrievedAt: "2026-07-18T05:00:00-04:00",
  anchor: { lat: 38.84, lng: -77.3, label: "Test anchor" },
  basis: "Test matrix",
  periods,
  alerts: [],
  dayKeys: ["2026-07-18"],
  locations: {
    "lake-test": {
      "largemouth-bass": {
        baseScore: 54,
        confidence: 72,
        confidenceLabel: "Moderate",
        hourlyScores: [68, 51],
        dailyScores: [68],
        dailyBestPeriodIndexes: [0],
      },
    },
  },
};

test("one precomputed hourly selection supplies map, list, and menu lookup", () => {
  const selected = selectedScoresFromMatrix(matrix, {
    mode: "hourly",
    key: periods[1].startTime,
  });
  assert.equal(selected.size, 1);
  assert.deepEqual(selected.get(matrixScoreKey("lake-test", "largemouth-bass")), {
    score: 51,
    period: periods[1],
  });
});

test("daily selection uses the species' precomputed best supported period", () => {
  const result = scoreFromMatrix(
    matrix,
    "lake-test",
    "largemouth-bass",
    { mode: "daily", key: "2026-07-18" },
    base,
  );
  assert.ok(result);
  assert.equal(result.opportunity.score, 68);
  assert.equal(result.opportunity.activity, base.activity);
  assert.equal(result.period.startTime, periods[0].startTime);
});

test("unsupported or missing matrix selections never invent a score", () => {
  assert.equal(
    scoreFromMatrix(
      matrix,
      "lake-test",
      "largemouth-bass",
      { mode: "daily", key: "2026-07-19" },
      base,
    ),
    null,
  );
});
