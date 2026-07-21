import type { NwsAlert, NwsForecastPeriod } from "../forecast";

const NWS_HEADERS = {
  Accept: "application/geo+json",
  "User-Agent": process.env.NWS_USER_AGENT ?? "BiteMap-NOVA/0.1 (contact: admin@example.com)",
};

type RawNwsPeriod = Omit<NwsForecastPeriod, "precipitationProbability"> & {
  probabilityOfPrecipitation?: { value?: number | null };
};

export type NwsConditionsPayload = {
  temperature: number;
  temperatureUnit: string;
  shortForecast: string;
  windSpeed: string;
  windDirection: string;
  precipitationProbability: number | null;
  validTime: string;
  retrievedAt: string;
  provider: "National Weather Service";
  coverage: {
    hourlyStart: string | null;
    hourlyEnd: string | null;
    unsupportedFutureDisabled: true;
  };
  observed: false;
  periods: NwsForecastPeriod[];
  alerts: NwsAlert[];
};

export async function fetchNwsConditions(lat: number, lon: number): Promise<NwsConditionsPayload> {
  const pointsResponse = await fetch(
    `https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`,
    { headers: NWS_HEADERS, signal: AbortSignal.timeout(8000) },
  );
  if (!pointsResponse.ok) throw new Error(`NWS points returned ${pointsResponse.status}`);
  const points = await pointsResponse.json() as { properties?: { forecastHourly?: string } };
  const hourlyUrl = points.properties?.forecastHourly;
  if (!hourlyUrl) throw new Error("NWS hourly endpoint missing");

  const alertsUrl = new URL("https://api.weather.gov/alerts/active");
  alertsUrl.searchParams.set("point", `${lat.toFixed(4)},${lon.toFixed(4)}`);
  const [hourlyResponse, alertsResponse] = await Promise.all([
    fetch(hourlyUrl, { headers: NWS_HEADERS, signal: AbortSignal.timeout(8000) }),
    fetch(alertsUrl, { headers: NWS_HEADERS, signal: AbortSignal.timeout(8000) }).catch(() => null),
  ]);
  if (!hourlyResponse.ok) throw new Error(`NWS hourly returned ${hourlyResponse.status}`);

  const hourly = await hourlyResponse.json() as {
    properties?: { updated?: string; periods?: RawNwsPeriod[] };
  };
  const alertPayload = alertsResponse?.ok ? await alertsResponse.json() as {
    features?: Array<{ id?: string; properties?: {
      id?: string;
      event?: string;
      severity?: string;
      urgency?: string;
      headline?: string;
      description?: string;
      instruction?: string | null;
      onset?: string;
      expires?: string;
    } }>;
  } : null;
  const rawPeriods = (hourly.properties?.periods ?? []).slice(0, 120);
  const first = rawPeriods[0];
  if (!first) throw new Error("NWS hourly period missing");

  const periods = rawPeriods.map((period): NwsForecastPeriod => ({
    startTime: period.startTime,
    temperature: period.temperature,
    temperatureUnit: period.temperatureUnit,
    shortForecast: period.shortForecast,
    windSpeed: period.windSpeed,
    windDirection: period.windDirection,
    windGust: period.windGust ?? null,
    isDaytime: period.isDaytime ?? null,
    precipitationProbability: period.probabilityOfPrecipitation?.value ?? null,
  }));
  const alerts = (alertPayload?.features ?? []).map(({ id, properties }): NwsAlert => ({
    id: properties?.id ?? id ?? properties?.headline ?? "nws-alert",
    event: properties?.event ?? "Weather alert",
    severity: properties?.severity ?? "Unknown",
    urgency: properties?.urgency ?? "Unknown",
    headline: properties?.headline ?? properties?.event ?? "Active National Weather Service alert",
    description: properties?.description ?? "",
    instruction: properties?.instruction ?? null,
    onset: properties?.onset ?? null,
    expires: properties?.expires ?? null,
  }));
  return {
    temperature: first.temperature,
    temperatureUnit: first.temperatureUnit,
    shortForecast: first.shortForecast,
    windSpeed: first.windSpeed,
    windDirection: first.windDirection,
    precipitationProbability: first.probabilityOfPrecipitation?.value ?? null,
    validTime: first.startTime,
    retrievedAt: hourly.properties?.updated ?? new Date().toISOString(),
    provider: "National Weather Service",
    coverage: {
      hourlyStart: periods[0]?.startTime ?? null,
      hourlyEnd: periods.at(-1)?.startTime ?? null,
      unsupportedFutureDisabled: true,
    },
    observed: false,
    periods,
    alerts,
  };
}
