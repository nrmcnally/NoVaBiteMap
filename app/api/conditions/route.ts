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
    const hourlyResponse = await fetch(hourlyUrl, { headers: NWS_HEADERS, signal: AbortSignal.timeout(8000) });
    if (!hourlyResponse.ok) throw new Error(`NWS hourly returned ${hourlyResponse.status}`);
    const hourly = await hourlyResponse.json() as {
      properties?: { updated?: string; periods?: Array<{
        startTime: string;
        temperature: number;
        temperatureUnit: string;
        shortForecast: string;
        windSpeed: string;
        windDirection: string;
        probabilityOfPrecipitation?: { value?: number | null };
      }> };
    };
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
      observed: false,
    });
  } catch (error) {
    return Response.json({
      error: "Live NWS forecast unavailable. BiteMap did not create a fallback observation.",
      detail: error instanceof Error ? error.message : "Unknown provider error",
      provider: "National Weather Service",
    }, { status: 503 });
  }
}

