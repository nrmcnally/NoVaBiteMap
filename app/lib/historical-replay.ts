import { locationById } from "./data";
import { hydrologyForLocation, type HydrologyAssociation } from "./hydrology";

export const HISTORICAL_REPLAY_POLICY_VERSION = "historical-replay-v0.1.0";

const OPEN_METEO_DOCS = "https://open-meteo.com/en/docs/historical-forecast-api";
const USGS_IV_DOCS =
  "https://waterservices.usgs.gov/docs/instantaneous-values/instantaneous-values-details/";
const WEATHER_VARIABLES = [
  "temperature_2m",
  "relative_humidity_2m",
  "precipitation",
  "cloud_cover",
  "surface_pressure",
  "wind_speed_10m",
  "weather_code",
] as const;
const USGS_PARAMETERS = ["00010", "00060", "00065", "00095", "00300", "63680"] as const;

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export type ConditionReplayStatus = "not-requested" | "complete" | "partial" | "unavailable";
export type ReplaySourceStatus = "complete" | "unavailable" | "not-mapped";

export type HistoricalWeatherRow = {
  time: string;
  temperatureC: number | null;
  relativeHumidityPercent: number | null;
  precipitationMm: number | null;
  cloudCoverPercent: number | null;
  surfacePressureHpa: number | null;
  windSpeedKph: number | null;
  weatherCode: number | null;
};

export type HistoricalConditionReplay = {
  replayId: string;
  policyVersion: typeof HISTORICAL_REPLAY_POLICY_VERSION;
  generatedBy: "bitemap-server";
  reconstructedAt: string;
  status: Exclude<ConditionReplayStatus, "not-requested">;
  tripWindow: {
    locationId: string;
    startedAt: string;
    endedAt: string;
  };
  location: {
    name: string;
    waterbody: string;
    waterbodyType: string;
  };
  coverage: {
    weather: ReplaySourceStatus;
    hydrology: ReplaySourceStatus;
    solar: "complete";
    missing: string[];
  };
  weather: {
    status: Exclude<ReplaySourceStatus, "not-mapped">;
    provider: "Open-Meteo";
    dataset: string | null;
    retrievedAt: string;
    sourceDocsUrl: typeof OPEN_METEO_DOCS;
    limitation: string;
    sampleCount: number;
    hourly: HistoricalWeatherRow[];
    summary: {
      meanTemperatureC: number | null;
      minTemperatureC: number | null;
      maxTemperatureC: number | null;
      meanRelativeHumidityPercent: number | null;
      precipitationTotalMm: number | null;
      meanCloudCoverPercent: number | null;
      meanSurfacePressureHpa: number | null;
      meanWindSpeedKph: number | null;
      weatherCodes: number[];
    };
  };
  hydrology: {
    status: ReplaySourceStatus;
    provider: "USGS" | null;
    retrievedAt: string | null;
    sourceDocsUrl: typeof USGS_IV_DOCS;
    station: HydrologyAssociation | null;
    limitation: string;
    metrics: Array<{
      parameterCode: string;
      name: string;
      unit: string | null;
      sampleCount: number;
      minimum: number;
      maximum: number;
      mean: number;
      first: number;
      last: number;
      trend: "rising" | "falling" | "steady";
      samples: Array<{ time: string; value: number; qualifiers: string[] }>;
    }>;
  };
  solar: {
    status: "complete";
    method: "deterministic-solar-geometry";
    limitation: string;
    start: SolarSample;
    midpoint: SolarSample;
    end: SolarSample;
  };
};

type ReplayInput = {
  locationId: string;
  startedAt: string;
  endedAt: string;
};

type SolarSample = {
  time: string;
  elevationDegrees: number;
  phase: "night" | "twilight" | "day" | "bright";
};

type WeatherCandidate = {
  endpoint: string;
  dataset: string;
  limitation: string;
};

type OpenMeteoHourly = Record<string, Array<string | number | null> | undefined> & {
  time?: string[];
};

type OpenMeteoPayload = {
  hourly?: OpenMeteoHourly;
};

type UsgsValue = {
  value?: string;
  dateTime?: string;
  qualifiers?: string[];
};

type UsgsSeries = {
  variable?: {
    variableCode?: Array<{ value?: string }>;
    variableDescription?: string;
    unit?: { unitCode?: string };
  };
  values?: Array<{ value?: UsgsValue[] }>;
};

type UsgsPayload = {
  value?: { timeSeries?: UsgsSeries[] };
};

/**
 * Rebuilds environmental context without inspecting the trip outcome.
 * Keep this input deliberately narrow: catch, target, lure, notes, and consent
 * must never influence which conditions are fetched or how they are summarized.
 */
export async function reconstructHistoricalConditions(
  input: ReplayInput,
  fetcher: FetchLike = fetch,
): Promise<HistoricalConditionReplay> {
  const location = locationById(input.locationId);
  if (!location) throw new Error("Unknown BiteMap location.");
  const startedMs = Date.parse(input.startedAt);
  const endedMs = Date.parse(input.endedAt);
  if (!Number.isFinite(startedMs) || !Number.isFinite(endedMs) || endedMs <= startedMs) {
    throw new Error("Invalid trip interval.");
  }
  if (endedMs > Date.now() + 15 * 60_000) throw new Error("Historical replay requires a completed trip.");

  const startedAt = new Date(startedMs).toISOString();
  const endedAt = new Date(endedMs).toISOString();
  const retrievedAt = new Date().toISOString();
  const association = hydrologyForLocation(location.id) ?? null;

  const [weather, hydrology] = await Promise.all([
    reconstructWeather(location.lat, location.lng, startedMs, endedMs, retrievedAt, fetcher),
    reconstructHydrology(association, startedMs, endedMs, retrievedAt, fetcher),
  ]);
  const solar = reconstructSolar(location.lat, location.lng, startedMs, endedMs);
  const missing: string[] = [];
  if (weather.status !== "complete") missing.push("modeled weather history");
  if (hydrology.status === "unavailable") missing.push("mapped USGS station readings");
  if (hydrology.status === "not-mapped") missing.push("location-specific USGS station mapping");
  const status: HistoricalConditionReplay["status"] =
    weather.status === "complete" && hydrology.status !== "unavailable"
      ? "complete"
      : weather.status === "complete" || hydrology.status === "complete"
        ? "partial"
        : "unavailable";

  return {
    replayId: crypto.randomUUID(),
    policyVersion: HISTORICAL_REPLAY_POLICY_VERSION,
    generatedBy: "bitemap-server",
    reconstructedAt: retrievedAt,
    status,
    tripWindow: { locationId: location.id, startedAt, endedAt },
    location: {
      name: location.name,
      waterbody: location.waterbody,
      waterbodyType: location.waterbodyType,
    },
    coverage: {
      weather: weather.status,
      hydrology: hydrology.status,
      solar: "complete",
      missing,
    },
    weather,
    hydrology,
    solar,
  };
}

async function reconstructWeather(
  latitude: number,
  longitude: number,
  startedMs: number,
  endedMs: number,
  retrievedAt: string,
  fetcher: FetchLike,
): Promise<HistoricalConditionReplay["weather"]> {
  const candidates = weatherCandidates(endedMs);
  for (const candidate of candidates) {
    try {
      const url = new URL(candidate.endpoint);
      url.searchParams.set("latitude", latitude.toFixed(5));
      url.searchParams.set("longitude", longitude.toFixed(5));
      url.searchParams.set("start_date", utcDate(startedMs));
      url.searchParams.set("end_date", utcDate(endedMs));
      url.searchParams.set("hourly", WEATHER_VARIABLES.join(","));
      url.searchParams.set("timezone", "UTC");
      const response = await fetcher(url, {
        headers: { accept: "application/json", "user-agent": "BiteMap-NOVA/0.1" },
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      });
      if (!response.ok) continue;
      const payload = await response.json() as OpenMeteoPayload;
      const hourly = normalizeWeatherRows(payload.hourly, startedMs, endedMs);
      if (!hourly.length) continue;
      return {
        status: "complete",
        provider: "Open-Meteo",
        dataset: candidate.dataset,
        retrievedAt,
        sourceDocsUrl: OPEN_METEO_DOCS,
        limitation: candidate.limitation,
        sampleCount: hourly.length,
        hourly,
        summary: weatherSummary(hourly),
      };
    } catch {
      // Try the next explicitly labeled modeled dataset.
    }
  }
  return {
    status: "unavailable",
    provider: "Open-Meteo",
    dataset: null,
    retrievedAt,
    sourceDocsUrl: OPEN_METEO_DOCS,
    limitation:
      "No modeled weather rows were available for this interval. This is provider missingness, not evidence about the trip outcome.",
    sampleCount: 0,
    hourly: [],
    summary: weatherSummary([]),
  };
}

function weatherCandidates(endedMs: number): WeatherCandidate[] {
  const recent = Date.now() - endedMs <= 92 * 86_400_000;
  const historicalForecast: WeatherCandidate = {
    endpoint: "https://historical-forecast-api.open-meteo.com/v1/forecast",
    dataset: "modeled-historical-forecast",
    limitation:
      "Modeled reconstruction from archived operational forecasts; it is not a station observation and may differ from conditions at the access point.",
  };
  const recentForecast: WeatherCandidate = {
    endpoint: "https://api.open-meteo.com/v1/forecast",
    dataset: "modeled-recent-forecast-window",
    limitation:
      "Modeled values retained in the forecast API's recent past window; they are not station observations and may differ at the access point.",
  };
  const reanalysis: WeatherCandidate = {
    endpoint: "https://archive-api.open-meteo.com/v1/archive",
    dataset: "modeled-weather-reanalysis",
    limitation:
      "Modeled reanalysis used only when archived operational forecast rows are unavailable; it is not a station observation or a preserved BiteMap forecast.",
  };
  return recent
    ? [recentForecast, historicalForecast, reanalysis]
    : [historicalForecast, reanalysis];
}

function normalizeWeatherRows(
  hourly: OpenMeteoHourly | undefined,
  startedMs: number,
  endedMs: number,
): HistoricalWeatherRow[] {
  const times = hourly?.time ?? [];
  const rows = times.map((time, index) => ({
    time: isoUtc(time),
    timestamp: Date.parse(isoUtc(time)),
    temperatureC: arrayNumber(hourly?.temperature_2m, index),
    relativeHumidityPercent: arrayNumber(hourly?.relative_humidity_2m, index),
    precipitationMm: arrayNumber(hourly?.precipitation, index),
    cloudCoverPercent: arrayNumber(hourly?.cloud_cover, index),
    surfacePressureHpa: arrayNumber(hourly?.surface_pressure, index),
    windSpeedKph: arrayNumber(hourly?.wind_speed_10m, index),
    weatherCode: arrayNumber(hourly?.weather_code, index),
  })).filter((row) => Number.isFinite(row.timestamp));
  const paddedStart = startedMs - 30 * 60_000;
  const paddedEnd = endedMs + 30 * 60_000;
  let selected = rows.filter((row) => row.timestamp >= paddedStart && row.timestamp <= paddedEnd);
  if (!selected.length && rows.length) {
    const midpoint = (startedMs + endedMs) / 2;
    const nearest = rows.reduce((best, row) =>
      Math.abs(row.timestamp - midpoint) < Math.abs(best.timestamp - midpoint) ? row : best);
    if (Math.abs(nearest.timestamp - midpoint) <= 90 * 60_000) selected = [nearest];
  }
  return selected.map((row) => ({
    time: row.time,
    temperatureC: row.temperatureC,
    relativeHumidityPercent: row.relativeHumidityPercent,
    precipitationMm: row.precipitationMm,
    cloudCoverPercent: row.cloudCoverPercent,
    surfacePressureHpa: row.surfacePressureHpa,
    windSpeedKph: row.windSpeedKph,
    weatherCode: row.weatherCode,
  }));
}

async function reconstructHydrology(
  association: HydrologyAssociation | null,
  startedMs: number,
  endedMs: number,
  retrievedAt: string,
  fetcher: FetchLike,
): Promise<HistoricalConditionReplay["hydrology"]> {
  if (!association) {
    return {
      status: "not-mapped",
      provider: null,
      retrievedAt: null,
      sourceDocsUrl: USGS_IV_DOCS,
      station: null,
      limitation:
        "No manually verified USGS station relationship is mapped for this BiteMap location; no station was guessed by proximity.",
      metrics: [],
    };
  }
  try {
    const url = new URL("https://waterservices.usgs.gov/nwis/iv/");
    url.searchParams.set("format", "json");
    url.searchParams.set("sites", association.stationId);
    url.searchParams.set("parameterCd", USGS_PARAMETERS.join(","));
    const ageDays = Math.ceil((Date.now() - startedMs) / 86_400_000);
    if (ageDays >= 1 && ageDays <= 120) {
      // The relative-period route is more reliable for the service's recent,
      // provisional window. Values are still filtered to the exact trip below.
      url.searchParams.set("period", `P${ageDays}D`);
    } else {
      // WaterServices documents minute-resolution ISO-8601 query timestamps.
      url.searchParams.set("startDT", usgsDateTime(startedMs));
      url.searchParams.set("endDT", usgsDateTime(endedMs));
    }
    url.searchParams.set("siteStatus", "all");
    const response = await fetcher(url, {
      headers: { accept: "application/json", "user-agent": "BiteMap-NOVA/0.1" },
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error(`USGS returned HTTP ${response.status}.`);
    const payload = await response.json() as UsgsPayload;
    const metrics = normalizeUsgsMetrics(payload, startedMs, endedMs);
    if (!metrics.length) {
      const rawTimes = (payload.value?.timeSeries ?? []).flatMap((series) =>
        (series.values ?? []).flatMap((block) => block.value ?? [])
          .flatMap((sample) => sample.dateTime ? [sample.dateTime] : []));
      const range = rawTimes.length
        ? ` Provider rows span ${rawTimes[0]} through ${rawTimes.at(-1)}.`
        : "";
      throw new Error(`USGS returned no usable values in the trip interval.${range}`);
    }
    return {
      status: "complete",
      provider: "USGS",
      retrievedAt,
      sourceDocsUrl: USGS_IV_DOCS,
      station: association,
      limitation:
        `${association.limitation} USGS instantaneous values can be provisional and are contextual conditions, never a safety determination.`,
      metrics,
    };
  } catch (error) {
    const providerNote = error instanceof Error ? error.message : "USGS retrieval failed.";
    return {
      status: "unavailable",
      provider: "USGS",
      retrievedAt,
      sourceDocsUrl: USGS_IV_DOCS,
      station: association,
      limitation:
        `${association.limitation} ${providerNote} This missingness does not describe the trip outcome.`,
      metrics: [],
    };
  }
}

function normalizeUsgsMetrics(
  payload: UsgsPayload,
  startedMs: number,
  endedMs: number,
): HistoricalConditionReplay["hydrology"]["metrics"] {
  return (payload.value?.timeSeries ?? []).flatMap((series) => {
    const parameterCode = series.variable?.variableCode?.[0]?.value ?? "";
    const samples = (series.values ?? []).flatMap((block) => block.value ?? [])
      .map((sample) => ({
        time: sample.dateTime ? new Date(sample.dateTime).toISOString() : "",
        timestamp: sample.dateTime ? Date.parse(sample.dateTime) : Number.NaN,
        value: Number(sample.value),
        qualifiers: sample.qualifiers ?? [],
      }))
      .filter((sample) =>
        sample.time
        && Number.isFinite(sample.timestamp)
        && sample.timestamp >= startedMs
        && sample.timestamp <= endedMs
        && Number.isFinite(sample.value)
        && sample.value > -999_000);
    if (!samples.length) return [];
    const values = samples.map((sample) => sample.value);
    const first = values[0];
    const last = values.at(-1) ?? first;
    const tolerance = Math.max(Math.abs(first) * 0.01, 0.01);
    return [{
      parameterCode,
      name: series.variable?.variableDescription ?? `USGS parameter ${parameterCode}`,
      unit: series.variable?.unit?.unitCode ?? null,
      sampleCount: samples.length,
      minimum: rounded(Math.min(...values)),
      maximum: rounded(Math.max(...values)),
      mean: rounded(mean(values)),
      first: rounded(first),
      last: rounded(last),
      trend: last - first > tolerance ? "rising" as const
        : first - last > tolerance ? "falling" as const
          : "steady" as const,
      samples: evenlySample(samples, 96).map((sample) => ({
        time: sample.time,
        value: sample.value,
        qualifiers: sample.qualifiers,
      })),
    }];
  });
}

function reconstructSolar(
  latitude: number,
  longitude: number,
  startedMs: number,
  endedMs: number,
): HistoricalConditionReplay["solar"] {
  return {
    status: "complete",
    method: "deterministic-solar-geometry",
    limitation:
      "Solar phase is computed from time and coordinates; terrain, trees, cloud cover, and local shade are not included.",
    start: solarSample(startedMs, latitude, longitude),
    midpoint: solarSample((startedMs + endedMs) / 2, latitude, longitude),
    end: solarSample(endedMs, latitude, longitude),
  };
}

function solarSample(timestamp: number, latitude: number, longitude: number): SolarSample {
  const date = new Date(timestamp);
  const julianDate = date.getTime() / 86_400_000 + 2_440_587.5;
  const n = julianDate - 2_451_545;
  const meanLongitude = modulo(280.460 + 0.9856474 * n, 360);
  const meanAnomaly = modulo(357.528 + 0.9856003 * n, 360);
  const eclipticLongitude = meanLongitude
    + 1.915 * Math.sin(toRadians(meanAnomaly))
    + 0.020 * Math.sin(toRadians(2 * meanAnomaly));
  const obliquity = 23.439 - 0.0000004 * n;
  const declination = toDegrees(Math.asin(
    Math.sin(toRadians(obliquity)) * Math.sin(toRadians(eclipticLongitude)),
  ));
  const gmst = modulo(280.46061837 + 360.98564736629 * n, 360);
  const lmst = modulo(gmst + longitude, 360);
  const rightAscension = toDegrees(Math.atan2(
    Math.cos(toRadians(obliquity)) * Math.sin(toRadians(eclipticLongitude)),
    Math.cos(toRadians(eclipticLongitude)),
  ));
  const hourAngle = modulo(lmst - rightAscension + 180, 360) - 180;
  const elevation = toDegrees(Math.asin(
    Math.sin(toRadians(latitude)) * Math.sin(toRadians(declination))
    + Math.cos(toRadians(latitude)) * Math.cos(toRadians(declination))
      * Math.cos(toRadians(hourAngle)),
  ));
  const phase: SolarSample["phase"] =
    elevation < -6 ? "night" : elevation < 8 ? "twilight" : elevation < 45 ? "day" : "bright";
  return {
    time: date.toISOString(),
    elevationDegrees: rounded(elevation),
    phase,
  };
}

function weatherSummary(rows: HistoricalWeatherRow[]): HistoricalConditionReplay["weather"]["summary"] {
  const values = <K extends keyof HistoricalWeatherRow>(key: K) =>
    rows.map((row) => row[key]).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const temperatures = values("temperatureC");
  const precipitation = values("precipitationMm");
  const codes = values("weatherCode").map(Math.round);
  return {
    meanTemperatureC: nullableMean(temperatures),
    minTemperatureC: temperatures.length ? rounded(Math.min(...temperatures)) : null,
    maxTemperatureC: temperatures.length ? rounded(Math.max(...temperatures)) : null,
    meanRelativeHumidityPercent: nullableMean(values("relativeHumidityPercent")),
    precipitationTotalMm: precipitation.length ? rounded(precipitation.reduce((sum, value) => sum + value, 0)) : null,
    meanCloudCoverPercent: nullableMean(values("cloudCoverPercent")),
    meanSurfacePressureHpa: nullableMean(values("surfacePressureHpa")),
    meanWindSpeedKph: nullableMean(values("windSpeedKph")),
    weatherCodes: [...new Set(codes)],
  };
}

function arrayNumber(values: Array<string | number | null> | undefined, index: number): number | null {
  const raw = values?.[index];
  if (raw === null || raw === undefined || raw === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function evenlySample<T>(values: T[], limit: number): T[] {
  if (values.length <= limit) return values;
  return Array.from({ length: limit }, (_, index) =>
    values[Math.round(index * (values.length - 1) / (limit - 1))]);
}

function isoUtc(value: string): string {
  return new Date(/[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`).toISOString();
}

function utcDate(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function usgsDateTime(timestamp: number): string {
  return `${new Date(timestamp).toISOString().slice(0, 16)}Z`;
}

function nullableMean(values: number[]): number | null {
  return values.length ? rounded(mean(values)) : null;
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function rounded(value: number): number {
  return Math.round(value * 100) / 100;
}

function toRadians(value: number): number {
  return value * Math.PI / 180;
}

function toDegrees(value: number): number {
  return value * 180 / Math.PI;
}

function modulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}
