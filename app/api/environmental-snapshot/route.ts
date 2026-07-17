function backendBaseUrl() {
  const configured = process.env.API_BASE_URL?.trim();
  if (configured === "") return null;
  return (configured || "http://localhost:8000").replace(/\/$/, "");
}

function validSlug(value: string) {
  return /^[a-z0-9][a-z0-9-]{0,119}$/.test(value);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const locationId = url.searchParams.get("locationId")?.trim() ?? "";
  const at = url.searchParams.get("at")?.trim() ?? "";
  const hasOffset = /(?:Z|[+-]\d{2}:\d{2})$/i.test(at);
  if (!validSlug(locationId) || !hasOffset || !Number.isFinite(Date.parse(at))) {
    return Response.json({
      error: "A valid locationId and an ISO timestamp with a time-zone offset are required.",
    }, { status: 400 });
  }
  const base = backendBaseUrl();
  if (!base) {
    return Response.json({ error: "Canonical forecast backend is disabled." }, { status: 503 });
  }
  try {
    const endpoint = new URL(
      `${base}/api/locations/${encodeURIComponent(locationId)}/environmental-snapshot`,
    );
    endpoint.searchParams.set("at", at);
    const response = await fetch(endpoint, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    const payload = await response.json().catch(() => null);
    return Response.json(
      response.ok ? payload : {
        error: response.status === 422
          ? "That time is outside the supported forecast window."
          : "The environmental snapshot is temporarily unavailable.",
        detail: payload,
      },
      {
        status: response.status,
        headers: { "cache-control": "private, no-store" },
      },
    );
  } catch (error) {
    return Response.json({
      error: "The environmental snapshot is temporarily unavailable.",
      detail: error instanceof Error ? error.message : "Unknown backend error",
    }, { status: 503 });
  }
}
