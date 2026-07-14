type CensusMatch = {
  matchedAddress?: string;
  coordinates?: { x?: number; y?: number };
};

type NominatimMatch = {
  display_name?: string;
  lat?: string;
  lon?: string;
};

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim();
  if (!query || query.length < 3 || query.length > 180) {
    return Response.json({ error: "Enter a complete address, city, or ZIP code." }, { status: 400 });
  }

  const census = new URL("https://geocoding.geo.census.gov/geocoder/locations/onelineaddress");
  census.searchParams.set("address", query);
  census.searchParams.set("benchmark", "Public_AR_Current");
  census.searchParams.set("format", "json");

  try {
    const response = await fetch(census, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(6500),
    });
    if (response.ok) {
      const body = await response.json() as { result?: { addressMatches?: CensusMatch[] } };
      const match = body.result?.addressMatches?.[0];
      const lat = match?.coordinates?.y;
      const lng = match?.coordinates?.x;
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return geocodeResponse(match?.matchedAddress ?? query, lat!, lng!, "U.S. Census Geocoder");
      }
    }
  } catch {
    // ZIP-only and locality searches are handled by the secondary provider.
  }

  const nominatim = new URL("https://nominatim.openstreetmap.org/search");
  nominatim.searchParams.set("q", query);
  nominatim.searchParams.set("format", "jsonv2");
  nominatim.searchParams.set("countrycodes", "us");
  nominatim.searchParams.set("limit", "1");
  nominatim.searchParams.set("addressdetails", "1");

  try {
    const response = await fetch(nominatim, {
      headers: {
        accept: "application/json",
        "accept-language": "en-US,en;q=0.8",
        "user-agent": "BiteMap-NOVA/1.0",
      },
      signal: AbortSignal.timeout(6500),
    });
    if (response.ok) {
      const body = await response.json() as NominatimMatch[];
      const match = body[0];
      const lat = Number(match?.lat);
      const lng = Number(match?.lon);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return geocodeResponse(match.display_name ?? query, lat, lng, "OpenStreetMap Nominatim");
      }
    }
  } catch {
    // Fall through to a transparent unavailable response.
  }

  return Response.json({ error: "We could not locate that starting point. Try adding a city and state." }, { status: 404 });
}

function geocodeResponse(label: string, lat: number, lng: number, provider: string) {
  return Response.json(
    { label, lat, lng, provider },
    { headers: { "cache-control": "public, max-age=86400" } },
  );
}
