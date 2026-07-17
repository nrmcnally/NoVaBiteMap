function backendBaseUrl() {
  const configured = process.env.API_BASE_URL?.trim();
  if (configured === "") return null;
  return (configured || "http://localhost:8000").replace(/\/$/, "");
}

function validSlug(value: string) {
  return /^[a-z0-9][a-z0-9-]{0,119}$/.test(value);
}

export async function GET(request: Request) {
  const locationId = new URL(request.url).searchParams.get("locationId")?.trim() ?? "";
  if (!validSlug(locationId)) {
    return Response.json({ error: "A valid locationId is required." }, { status: 400 });
  }
  const base = backendBaseUrl();
  if (!base) {
    return Response.json({ error: "Canonical forecast backend is disabled." }, { status: 503 });
  }
  try {
    const response = await fetch(
      `${base}/api/locations/${encodeURIComponent(locationId)}/forecast-capabilities`,
      {
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(20_000),
      },
    );
    const payload = await response.json().catch(() => null);
    return Response.json(
      response.ok ? payload : {
        error: "Forecast capabilities are temporarily unavailable.",
        detail: payload,
      },
      {
        status: response.status,
        headers: { "cache-control": "private, no-store" },
      },
    );
  } catch (error) {
    return Response.json({
      error: "Forecast capabilities are temporarily unavailable.",
      detail: error instanceof Error ? error.message : "Unknown backend error",
    }, { status: 503 });
  }
}
