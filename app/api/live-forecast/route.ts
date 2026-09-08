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
  const speciesId = url.searchParams.get("speciesId")?.trim() ?? "";
  const wading = url.searchParams.get("wading") === "true";
  if (!validSlug(locationId) || !validSlug(speciesId)) {
    return Response.json(
      { error: "Valid locationId and speciesId are required." },
      { status: 400 },
    );
  }

  const base = backendBaseUrl();
  if (!base) {
    return Response.json(
      { error: "The detailed fishing forecast is unavailable." },
      { status: 503 },
    );
  }

  const endpoint = new URL(
    `${base}/api/locations/${encodeURIComponent(locationId)}/forecast`,
  );
  endpoint.searchParams.set("species_id", speciesId);
  endpoint.searchParams.set("wading", String(wading));

  try {
    const response = await fetch(endpoint, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      return Response.json(
        {
          error: "The detailed fishing forecast is temporarily unavailable.",
          detail: payload,
        },
        { status: response.status },
      );
    }
    return Response.json(payload, {
      headers: { "cache-control": "private, no-store" },
    });
  } catch (error) {
    return Response.json(
      {
        error: "The detailed fishing forecast is temporarily unavailable.",
        detail: error instanceof Error ? error.message : "Unknown backend error",
      },
      { status: 503 },
    );
  }
}
