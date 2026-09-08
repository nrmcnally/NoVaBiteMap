import { hydrologyForLocation } from "../../lib/hydrology";

type UsgsValue = { value: string; qualifiers?: string[]; dateTime: string };
type UsgsSeries = {
  sourceInfo?: { siteName?: string };
  variable?: {
    variableCode?: Array<{ value?: string }>;
    variableDescription?: string;
    unit?: { unitCode?: string };
    noDataValue?: number;
  };
  values?: Array<{ value?: UsgsValue[] }>;
};

const parameters: Record<string, { key: string; label: string }> = {
  "00010": { key: "waterTemperature", label: "Water temperature" },
  "00060": { key: "discharge", label: "Discharge" },
  "00065": { key: "gageHeight", label: "Gage height" },
  "00095": { key: "specificConductance", label: "Specific conductance" },
  "00300": { key: "dissolvedOxygen", label: "Dissolved oxygen" },
  "63680": { key: "turbidity", label: "Turbidity" },
};

function trendFor(values: UsgsValue[], code: string) {
  const valid = values
    .map((entry) => ({ ...entry, numeric: Number(entry.value) }))
    .filter((entry) => Number.isFinite(entry.numeric))
    .sort((a, b) => Date.parse(a.dateTime) - Date.parse(b.dateTime));
  const latest = valid.at(-1);
  if (!latest) return null;
  const target = Date.parse(latest.dateTime) - 6 * 60 * 60 * 1000;
  const earlier = [...valid].reverse().find((entry) => Date.parse(entry.dateTime) <= target) ?? valid[0];
  const delta = latest.numeric - earlier.numeric;
  const percent = earlier.numeric === 0 ? null : delta / Math.abs(earlier.numeric) * 100;
  const threshold = code === "00065" ? 0.08 : code === "00010" ? 0.5 : Math.max(Math.abs(earlier.numeric) * 0.08, 0.01);
  return {
    value: latest.numeric,
    observedAt: latest.dateTime,
    qualifiers: latest.qualifiers ?? [],
    direction: Math.abs(delta) < threshold ? "steady" : delta > 0 ? "rising" : "falling",
    delta: Number(delta.toFixed(code === "00060" ? 0 : 2)),
    deltaPercent: percent === null ? null : Number(percent.toFixed(1)),
    windowHours: Math.max(0, Math.round((Date.parse(latest.dateTime) - Date.parse(earlier.dateTime)) / 3_600_000)),
  };
}
export function normalizeUsgs(timeSeries: UsgsSeries[]) {
  const metrics: Record<string, unknown> = {};
  let newest = 0;
  for (const series of timeSeries) {
    const code = series.variable?.variableCode?.[0]?.value ?? "";
    const definition = parameters[code];
    if (!definition) continue;
    const trend = trendFor(series.values?.flatMap((group) => group.value ?? []) ?? [], code);
    if (!trend) continue;
    newest = Math.max(newest, Date.parse(trend.observedAt));
    metrics[definition.key] = {
      ...trend,
      code,
      label: definition.label,
      unit: series.variable?.unit?.unitCode ?? "",
      description: series.variable?.variableDescription ?? definition.label,
    };
  }
  const ageHours = newest ? (Date.now() - newest) / 3_600_000 : null;
  return {
    metrics,
    observedAt: newest ? new Date(newest).toISOString() : null,
    ageHours: ageHours === null ? null : Number(Math.max(0, ageHours).toFixed(1)),
    freshness: ageHours === null ? "unavailable" : ageHours <= 6 ? "fresh" : ageHours <= 24 ? "stale" : "old",
  };
}

export async function GET(request: Request) {
  const locationId = new URL(request.url).searchParams.get("locationId")?.trim() ?? "";
  const association = hydrologyForLocation(locationId);
  if (!association) {
    return Response.json({ available: false, reason: "No suitable USGS stream gauge is linked to this spot." }, { status: 404 });
  }

  const endpoint = new URL("https://waterservices.usgs.gov/nwis/iv/");
  endpoint.searchParams.set("format", "json");
  endpoint.searchParams.set("sites", association.stationId);
  endpoint.searchParams.set("parameterCd", "00060,00065,00010,00095,63680,00300");
  endpoint.searchParams.set("siteStatus", "all");
  endpoint.searchParams.set("period", "P2D");

  try {
    const response = await fetch(endpoint, {
      headers: { accept: "application/json", "user-agent": "BiteMap-NOVA/1.0" },
      signal: AbortSignal.timeout(9000),
    });
    if (!response.ok) throw new Error(`USGS returned ${response.status}`);
    const payload = await response.json() as { value?: { timeSeries?: UsgsSeries[] } };
    const normalized = normalizeUsgs(payload.value?.timeSeries ?? []);
    return Response.json({
      available: Object.keys(normalized.metrics).length > 0,
      provider: "USGS Water Data for the Nation",
      provisional: true,
      association,
      ...normalized,
      disclaimer: "Provisional gage data may be revised. A connected-reach reading does not establish access, boating, or wading safety.",
    }, { headers: { "cache-control": "public, max-age=900, stale-while-revalidate=1800" } });
  } catch (error) {
    return Response.json({
      available: false,
      provider: "USGS Water Data for the Nation",
      association,
      error: "Live USGS observations are temporarily unavailable.",
      detail: error instanceof Error ? error.message : "Unknown provider error",
    }, { status: 503 });
  }
}
