import assert from "node:assert/strict";
import test from "node:test";
import type { CanonicalOpportunity } from "../app/lib/data";
import type { NwsForecastPeriod } from "../app/lib/forecast";
import { buildForecast, buildTimelineScoreSeries, prepareForecastTimeline } from "../app/lib/forecast";
import {
  forecastDays,
  periodsForSelection,
  selectionFromSearch,
  selectionSearch,
} from "../app/lib/prediction-timeline";
import { opportunityForForecast } from "../app/lib/scoring";

const periods: NwsForecastPeriod[] = [
  {
    startTime: "2026-07-17T22:00:00-04:00",
    temperature: 78,
    temperatureUnit: "F",
    shortForecast: "Mostly Clear",
    windSpeed: "4 mph",
    windDirection: "SW",
    precipitationProbability: 5,
  },
  {
    startTime: "2026-07-17T23:00:00-04:00",
    temperature: 76,
    temperatureUnit: "F",
    shortForecast: "Clear",
    windSpeed: "3 mph",
    windDirection: "SW",
    precipitationProbability: 0,
  },
  {
    startTime: "2026-07-18T00:00:00-04:00",
    temperature: 75,
    temperatureUnit: "F",
    shortForecast: "Clear",
    windSpeed: "3 mph",
    windDirection: "W",
    precipitationProbability: 0,
  },
];

test("timeline accepts only exact provider-backed URL states", () => {
  assert.deepEqual(
    selectionFromSearch("?view=hourly&at=2026-07-17T23%3A00%3A00-04%3A00", periods),
    { mode: "hourly", key: periods[1].startTime },
  );
  assert.deepEqual(
    selectionFromSearch("?view=daily&day=2026-07-18", periods),
    { mode: "daily", key: "2026-07-18" },
  );
  assert.deepEqual(
    selectionFromSearch("?view=hourly&at=2027-01-01T00%3A00%3A00-05%3A00", periods),
    { mode: "hourly", key: periods[0].startTime },
  );
});

test("daily selections never invent hours outside the provider response", () => {
  const days = forecastDays(periods);
  assert.equal(days.length, 2);
  assert.deepEqual(
    periodsForSelection(periods, { mode: "daily", key: "2026-07-17" }).map((period) => period.startTime),
    periods.slice(0, 2).map((period) => period.startTime),
  );
  assert.deepEqual(periodsForSelection(periods, { mode: "daily", key: "2026-07-19" }), []);
});

test("shareable timeline state preserves unrelated filters", () => {
  const search = selectionSearch(
    "?species=channel-catfish&day=2026-07-17&view=daily",
    { mode: "hourly", key: periods[1].startTime },
  );
  const params = new URLSearchParams(search);
  assert.equal(params.get("species"), "channel-catfish");
  assert.equal(params.get("view"), "hourly");
  assert.equal(params.get("at"), periods[1].startTime);
  assert.equal(params.has("day"), false);
});

test("reviewed species diel profiles can change scores for the same night forecast", () => {
  const base: CanonicalOpportunity = {
    score: 60,
    confidence: 72,
    confidenceLabel: "Moderate",
    availability: 0.82,
    quality: 0.7,
    activity: 0.6,
    accessFit: 0.75,
    evidence: {
      speciesId: "channel-catfish",
      availability: 0.82,
      quality: 0.7,
      evidenceConfidence: 0.8,
      evidenceType: "official listing",
      evidenceSummary: "Test evidence",
      lastEvidence: "2026",
      technique: "",
      depth: "",
      positive: [],
      negative: [],
    },
  };
  const channel = opportunityForForecast(base, "channel-catfish", [periods[1]]);
  const smallmouth = opportunityForForecast(
    { ...base, evidence: { ...base.evidence, speciesId: "smallmouth-bass" } },
    "smallmouth-bass",
    [periods[1]],
  );
  assert.ok(channel);
  assert.ok(smallmouth);
  assert.ok(channel.opportunity.score > smallmouth.opportunity.score);
});

test("an alert caps only provider hours inside its official validity window", () => {
  const base: CanonicalOpportunity = {
    score: 70,
    confidence: 80,
    confidenceLabel: "High",
    availability: 0.9,
    quality: 0.8,
    activity: 0.8,
    accessFit: 0.8,
    evidence: {
      speciesId: "channel-catfish",
      availability: 0.9,
      quality: 0.8,
      evidenceConfidence: 0.85,
      evidenceType: "official listing",
      evidenceSummary: "Test evidence",
      lastEvidence: "2026",
      technique: "",
      depth: "",
      positive: [],
      negative: [],
    },
  };
  const alert = {
    id: "warning",
    event: "Severe Thunderstorm Warning",
    severity: "Severe",
    urgency: "Immediate",
    headline: "Severe Thunderstorm Warning",
    description: "",
    instruction: null,
    onset: "2026-07-17T22:30:00-04:00",
    expires: "2026-07-17T23:30:00-04:00",
  };
  const result = opportunityForForecast(base, "channel-catfish", periods, [alert]);
  assert.ok(result);
  assert.notEqual(result.period.startTime, periods[1].startTime);
  assert.ok(result.opportunity.score > 35);
});

test("the optimized timeline series matches the full forecast scorer", () => {
  const alerts = [{
    id: "warning",
    event: "Severe Thunderstorm Warning",
    severity: "Severe",
    urgency: "Immediate",
    headline: "Severe Thunderstorm Warning",
    description: "",
    instruction: null,
    onset: "2026-07-17T22:30:00-04:00",
    expires: "2026-07-17T23:30:00-04:00",
  }];
  const input = {
    availability: 0.84,
    quality: 0.68,
    accessFit: 0.8,
    dielPattern: "nocturnal",
    seasonalActivityByMonth: [0.35, 0.4, 0.5, 0.62, 0.75, 0.82, 0.88, 0.85, 0.72, 0.58, 0.44, 0.36],
  };
  const prepared = prepareForecastTimeline(periods, alerts);
  const series = buildTimelineScoreSeries(prepared, input);
  const full = buildForecast({
    periods,
    alerts,
    ...input,
    baseConfidence: 70,
    associationFactor: 1,
    hydrologyRelevant: false,
  });

  assert.deepEqual(series.hourlyScores, full.hourly.map((period) => period.score));
  assert.deepEqual(series.dailyScores, full.days.map((day) => day.score));
  assert.deepEqual(
    series.dailyBestPeriodIndexes.map((index) => index === null ? null : series.hourlyScores[index]),
    full.days.map((day) => day.score),
  );
});
