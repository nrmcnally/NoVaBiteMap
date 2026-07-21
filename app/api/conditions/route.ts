import { fetchNwsConditions } from "../../lib/server/nws";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const lat = Number(url.searchParams.get("lat"));
  const lon = Number(url.searchParams.get("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < 36 || lat > 40.5 || lon < -84 || lon > -74) {
    return Response.json({ error: "Valid Virginia-area lat and lon are required." }, { status: 400 });
  }
  try {
    return Response.json(await fetchNwsConditions(lat, lon));
  } catch (error) {
    return Response.json({
      error: "Live NWS forecast unavailable. BiteMap did not create a fallback observation.",
      detail: error instanceof Error ? error.message : "Unknown provider error",
      provider: "National Weather Service",
    }, { status: 503 });
  }
}
