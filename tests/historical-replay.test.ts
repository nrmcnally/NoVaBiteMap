import assert from "node:assert/strict";
import test from "node:test";
import { reconstructHistoricalConditions } from "../app/lib/historical-replay";

const weatherPayload = {
  hourly: {
    time: ["2026-07-15T10:00", "2026-07-15T11:00", "2026-07-15T12:00"],
    temperature_2m: [20, 21, 22],
    relative_humidity_2m: [80, 75, 70],
    precipitation: [0, 0.2, 0],
    cloud_cover: [40, 50, 60],
    surface_pressure: [1008, 1007, 1006],
    wind_speed_10m: [8, 9, 10],
    weather_code: [1, 2, 2],
  },
};

const usgsPayload = {
  value: {
    timeSeries: [{
      variable: {
        variableCode: [{ value: "00060" }],
        variableDescription: "Discharge, cubic feet per second",
        unit: { unitCode: "ft3/s" },
      },
      values: [{
        value: [
          { value: "1200", dateTime: "2026-07-15T10:30:00.000Z", qualifiers: ["P"] },
          { value: "1240", dateTime: "2026-07-15T11:30:00.000Z", qualifiers: ["P"] },
        ],
      }],
    }],
  },
};

test("reconstructs modeled weather, mapped USGS values, and solar without outcome fields", async () => {
  const requested: string[] = [];
  const replay = await reconstructHistoricalConditions({
    locationId: "point-of-rocks",
    startedAt: "2026-07-15T10:15:00.000Z",
    endedAt: "2026-07-15T11:45:00.000Z",
  }, async (input) => {
    const url = String(input);
    requested.push(url);
    if (url.includes("open-meteo.com")) return Response.json(weatherPayload);
    if (url.includes("waterservices.usgs.gov")) return Response.json(usgsPayload);
    return new Response(null, { status: 404 });
  });

  assert.equal(replay.status, "complete");
  assert.equal(replay.weather.dataset, "modeled-recent-forecast-window");
  assert.equal(replay.weather.summary.meanTemperatureC, 21);
  assert.equal(replay.weather.summary.precipitationTotalMm, 0.2);
  assert.equal(replay.hydrology.station?.stationId, "01638500");
  assert.equal(replay.hydrology.metrics[0]?.mean, 1220);
  assert.equal(replay.hydrology.metrics[0]?.trend, "rising");
  assert.equal(replay.solar.status, "complete");
  assert.ok(requested.every((url) => !url.includes("catch") && !url.includes("species")));
  const usgsRequest = requested.find((url) => url.includes("waterservices.usgs.gov"));
  assert.ok(usgsRequest);
  assert.ok(new URL(usgsRequest).searchParams.get("period")?.startsWith("P"));

  const serialized = JSON.stringify(replay);
  for (const forbidden of ["catchCount", "speciesId", "lureOrBait", "notes", "validationEligible"]) {
    assert.equal(serialized.includes(forbidden), false);
  }
});

test("does not guess a gauge for an unmapped location", async () => {
  const requested: string[] = [];
  const replay = await reconstructHistoricalConditions({
    locationId: "lake-burke",
    startedAt: "2026-07-15T10:15:00.000Z",
    endedAt: "2026-07-15T11:45:00.000Z",
  }, async (input) => {
    const url = String(input);
    requested.push(url);
    return Response.json(weatherPayload);
  });

  assert.equal(replay.status, "complete");
  assert.equal(replay.hydrology.status, "not-mapped");
  assert.equal(replay.hydrology.station, null);
  assert.ok(replay.coverage.missing.includes("location-specific USGS station mapping"));
  assert.equal(requested.some((url) => url.includes("waterservices.usgs.gov")), false);
});

test("keeps provider missingness explicit while retaining deterministic solar context", async () => {
  const replay = await reconstructHistoricalConditions({
    locationId: "point-of-rocks",
    startedAt: "2026-07-15T10:15:00.000Z",
    endedAt: "2026-07-15T11:45:00.000Z",
  }, async () => new Response(null, { status: 503 }));

  assert.equal(replay.status, "unavailable");
  assert.equal(replay.weather.status, "unavailable");
  assert.equal(replay.hydrology.status, "unavailable");
  assert.equal(replay.solar.status, "complete");
  assert.deepEqual(replay.coverage.missing, [
    "modeled weather history",
    "mapped USGS station readings",
  ]);
});
