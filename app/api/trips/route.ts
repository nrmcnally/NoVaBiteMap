import { locationById, speciesById } from "../../lib/data";
import {
  accountBackend,
  getAccountUser,
  normalizePasswordFishingTrip,
  passwordApiRequest,
  passwordSessionToken,
  responseErrorMessage,
  type PasswordFishingTripResponse,
} from "../../lib/account-server";
import { D1TripError } from "../../lib/d1-errors";

type TripBody = {
  locationId?: string;
  speciesId?: string;
  startedAt?: string;
  endedAt?: string;
  timezone?: string;
  anglerCount?: number;
  catchCount?: number;
  locationDetail?: string;
  lureOrBait?: string;
  observedWaterTemperatureC?: number | null;
  observedClarity?: string;
  notes?: string;
  consentForAggregateAnalysis?: boolean;
};

export async function GET() {
  const user = await getAccountUser();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  try {
    if (accountBackend() === "d1") {
      const { listD1FishingTrips } = await import("../../lib/d1-fishing-trips");
      return Response.json({ trips: await listD1FishingTrips(user) });
    }
    const token = await passwordSessionToken();
    if (!token) return Response.json({ error: "Sign in required." }, { status: 401 });
    const response = await passwordApiRequest("/api/users/me/fishing-trips", { method: "GET" }, token);
    if (!response.ok) {
      return Response.json({ error: await responseErrorMessage(response, "Unable to load trip logs.") }, { status: response.status });
    }
    const trips = (await response.json() as PasswordFishingTripResponse[]).map(normalizePasswordFishingTrip);
    return Response.json({ trips });
  } catch (error) {
    return tripError(error);
  }
}

export async function POST(request: Request) {
  const user = await getAccountUser();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  try {
    const body = await request.json() as TripBody;
    const checked = validateTrip(body);
    if ("error" in checked) return Response.json({ error: checked.error }, { status: 400 });
    const { location, species, input } = checked;
    if (!location.evidence.some((item) => item.speciesId === species.id && item.availability >= 0.35)) {
      return Response.json({ error: "That species is not evidenced at this BiteMap spot." }, { status: 400 });
    }
    const candidateCohort = species.id === "northern-snakehead" || species.id === "walleye";

    if (accountBackend() === "d1") {
      const { createD1FishingTrip } = await import("../../lib/d1-fishing-trips");
      const trip = await createD1FishingTrip(user, { ...input, candidateCohort });
      return Response.json({ trip }, { status: 201 });
    }

    const token = await passwordSessionToken();
    if (!token) return Response.json({ error: "Sign in required." }, { status: 401 });
    const response = await passwordApiRequest("/api/users/me/fishing-trips", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        location_id: input.locationId,
        species_id: input.speciesId,
        started_at: input.startedAt,
        ended_at: input.endedAt,
        timezone: input.timezone,
        angler_count: input.anglerCount,
        catch_count: input.catchCount,
        location_detail: input.locationDetail,
        lure_or_bait: input.lureOrBait,
        observed_water_temperature_c: input.observedWaterTemperatureC,
        observed_clarity: input.observedClarity,
        notes: input.notes,
        consent_for_aggregate_analysis: input.consentForAggregateAnalysis,
      }),
    }, token);
    if (!response.ok) {
      return Response.json({ error: await responseErrorMessage(response, "Unable to save trip log.") }, { status: response.status });
    }
    return Response.json({ trip: normalizePasswordFishingTrip(await response.json()) }, { status: 201 });
  } catch (error) {
    return tripError(error);
  }
}

function validateTrip(body: TripBody) {
  const location = body.locationId ? locationById(body.locationId) : undefined;
  const species = body.speciesId ? speciesById(body.speciesId) : undefined;
  if (!location) return { error: "Choose a valid BiteMap spot." } as const;
  if (!species) return { error: "Choose a valid species." } as const;
  const startedMs = Date.parse(body.startedAt ?? "");
  const endedMs = Date.parse(body.endedAt ?? "");
  if (!Number.isFinite(startedMs) || !Number.isFinite(endedMs)) return { error: "Enter valid trip times." } as const;
  if (endedMs <= startedMs) return { error: "Trip end time must be after its start time." } as const;
  const effortMinutes = Math.round((endedMs - startedMs) / 60_000);
  if (effortMinutes < 1 || effortMinutes > 10_080) return { error: "Trip length must be between 1 minute and 7 days." } as const;
  if (endedMs > Date.now() + 15 * 60_000) return { error: "Trip end time cannot be in the future." } as const;
  const anglerCount = Number(body.anglerCount);
  const catchCount = Number(body.catchCount);
  if (!Number.isInteger(anglerCount) || anglerCount < 1 || anglerCount > 20) return { error: "Angler count must be between 1 and 20." } as const;
  if (!Number.isInteger(catchCount) || catchCount < 0 || catchCount > 1000) return { error: "Catch count must be between 0 and 1,000." } as const;
  const waterTemp = body.observedWaterTemperatureC == null ? null : Number(body.observedWaterTemperatureC);
  if (waterTemp !== null && (!Number.isFinite(waterTemp) || waterTemp < -5 || waterTemp > 45)) {
    return { error: "Observed water temperature must be between -5 and 45 °C." } as const;
  }
  const clarity = clean(body.observedClarity, 30);
  if (clarity && !["clear", "stained", "muddy", "unknown"].includes(clarity)) return { error: "Unknown water clarity." } as const;
  const timezone = clean(body.timezone, 64) ?? "America/New_York";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
  } catch {
    return { error: "Unknown time zone." } as const;
  }
  return {
    location,
    species,
    input: {
      locationId: location.id,
      speciesId: species.id,
      startedAt: new Date(startedMs).toISOString(),
      endedAt: new Date(endedMs).toISOString(),
      timezone,
      anglerCount,
      catchCount,
      locationDetail: clean(body.locationDetail, 160),
      lureOrBait: clean(body.lureOrBait, 160),
      observedWaterTemperatureC: waterTemp,
      observedClarity: clarity,
      notes: clean(body.notes, 2000),
      consentForAggregateAnalysis: body.consentForAggregateAnalysis === true,
    },
  } as const;
}

function clean(value: string | undefined, max: number) {
  return value?.trim().slice(0, max) || null;
}

function tripError(error: unknown) {
  if (error instanceof D1TripError) return Response.json({ error: error.message }, { status: error.status });
  const message = error instanceof Error ? error.message : "";
  const migrationMissing = message.includes("no such table") || message.includes("fishing_trips");
  return Response.json({
    error: migrationMissing ? "Trip-log storage migration has not been applied yet." : "Trip-log storage is unavailable.",
  }, { status: 503 });
}
