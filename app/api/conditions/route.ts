const NWS_HEADERS = {
  Accept: "application/geo+json",
  "User-Agent": process.env.NWS_USER_AGENT ?? "BiteMap-NOVA/0.1 (contact: admin@example.com)",
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const lat = Number(url.searchParams.get("lat"));
  const lon = Number(url.searchParams.get("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < 36 || lat > 40.5 || lon < -84 || lon > -74) {
    return Response.json({ error: "Valid Virginia-area lat and lon are required." }, { status: 400 });
  }
  try {
    const pointsResponse = await fetch(`https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`, { headers: NWS_HEADERS, signal: AbortSignal.timeout(8000) });
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
      properties?: { updated?: string; periods?: Array<{
        startTime: string;
        temperature: number;
        temperatureUnit: string;
        shortForecast: string;
        windSpeed: string;
        windDirection: string;
        windGust?: string | null;
        isDaytime?: boolean;
        probabilityOfPrecipitation?: { value?: number | null };
      }> };
    };
    const alertPayload = alertsResponse?.ok ? await alertsResponse.json() as {
      features?: Array<{ properties?: {
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
    const period = hourly.properties?.periods?.[0];
    if (!period) throw new Error("NWS hourly period missing");
    return Response.json({
      temperature: period.temperature,
      temperatureUnit: period.temperatureUnit,
      shortForecast: period.shortForecast,
      windSpeed: period.windSpeed,
      windDirection: period.windDirection,
      precipitationProbability: period.probabilityOfPrecipitation?.value ?? null,
      validTime: period.startTime,
      retrievedAt: hourly.properties?.updated ?? new Date().toISOString(),
      provider: "National Weather Service",
      coverage: {
        hourlyStart: hourly.properties?.periods?.[0]?.startTime ?? null,
        hourlyEnd: hourly.properties?.periods?.slice(0, 120).at(-1)?.startTime ?? null,
        unsupportedFutureDisabled: true,
      },
      observed: false,
      periods: (hourly.properties?.periods ?? []).slice(0, 120).map((item) => ({
        startTime: item.startTime,
        temperature: item.temperature,
        temperatureUnit: item.temperatureUnit,
        shortForecast: item.shortForecast,
        windSpeed: item.windSpeed,
        windDirection: item.windDirection,
        windGust: item.windGust ?? null,
        isDaytime: item.isDaytime ?? null,
        precipitationProbability: item.probabilityOfPrecipitation?.value ?? null,
      })),
      alerts: (alertPayload?.features ?? []).map(({ properties }) => ({
        id: properties?.id ?? properties?.headline ?? "nws-alert",
        event: properties?.event ?? "Weather alert",
        severity: properties?.severity ?? "Unknown",
        urgency: properties?.urgency ?? "Unknown",
        headline: properties?.headline ?? properties?.event ?? "Active National Weather Service alert",
        description: properties?.description ?? "",
        instruction: properties?.instruction ?? null,
        onset: properties?.onset ?? null,
        expires: properties?.expires ?? null,
      })),
    });
  } catch (error) {
    return Response.json({
      error: "Live NWS forecast unavailable. BiteMap did not create a fallback observation.",
      detail: error instanceof Error ? error.message : "Unknown provider error",
      provider: "National Weather Service",
    }, { status: 503 });
  }
}
