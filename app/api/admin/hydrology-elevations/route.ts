import { getAccountUser } from "../../../lib/account-server";
import { isConfiguredAdmin } from "../../../lib/admin-auth";
import { locationById } from "../../../lib/data";
import type { HydrologyNodeElevation } from "../../../lib/d1-hydrology-elevations";

const EPQS_SOURCE = "USGS 3DEP Elevation Point Query Service";
const EPQS_URL = "https://epqs.nationalmap.gov/v1/json";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getAccountUser();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  if (!isConfiguredAdmin(user)) return Response.json({ error: "Administrator access required." }, { status: 403 });

  const rawIds = new URL(request.url).searchParams.getAll("locationId");
  const locationIds = [...new Set(rawIds)].slice(0, 10);
  const requested = locationIds.map(locationById).filter((location) => Boolean(location));
  if (!requested.length || requested.length !== locationIds.length) {
    return Response.json({ error: "Choose valid BiteMap nodes." }, { status: 400 });
  }

  try {
    const { listD1HydrologyNodeElevations, upsertD1HydrologyNodeElevation } = await import("../../../lib/d1-hydrology-elevations");
    const cached = await listD1HydrologyNodeElevations(locationIds);
    const byId = new Map(cached.map((item) => [item.locationId, item]));
    const missing = requested.filter((location) => !byId.has(location.id));
    const fetched = await Promise.all(missing.map(fetchElevation));
    for (const item of fetched) {
      await upsertD1HydrologyNodeElevation(item);
      byId.set(item.locationId, item);
    }
    return Response.json({
      elevations: locationIds.map((id) => byId.get(id)).filter(Boolean),
      caveat: "USGS EPQS returns interpolated ground elevation. BiteMap uses it only to suggest flow direction, never to verify it.",
    }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const missingMigration = /no such table|hydrology_node_elevations/i.test(message);
    return Response.json({
      error: missingMigration
        ? "Elevation storage is not ready. Apply the current database migration."
        : "USGS elevation is temporarily unavailable for these nodes.",
    }, { status: 503 });
  }
}

async function fetchElevation(location: NonNullable<ReturnType<typeof locationById>>): Promise<HydrologyNodeElevation> {
  const sourceUrl = `${EPQS_URL}?x=${encodeURIComponent(location.lng)}&y=${encodeURIComponent(location.lat)}&wkid=4326&units=Feet&includeDate=false`;
  const response = await fetch(sourceUrl, {
    headers: { accept: "application/json", "user-agent": "BiteMap-NOVA/0.1 hydrology-editor" },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`USGS EPQS returned ${response.status}`);
  const body = await response.json() as { value?: number | string; resolution?: number | string };
  const elevationFeet = Number(body.value);
  if (!Number.isFinite(elevationFeet) || elevationFeet <= -999999) throw new Error("USGS EPQS returned no elevation");
  const resolution = Number(body.resolution);
  return {
    locationId: location.id,
    elevationFeet: Math.round(elevationFeet * 10) / 10,
    resolutionMeters: Number.isFinite(resolution) ? resolution : null,
    source: EPQS_SOURCE,
    sourceUrl,
    sampledAt: new Date().toISOString(),
  };
}
