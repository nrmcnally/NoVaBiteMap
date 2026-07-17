import { and, desc, eq } from "drizzle-orm";
import { D1TripError } from "./d1-errors";
import { getDb } from "../../db";
import { fishingTrips } from "../../db/schema";
import type { AccountFishingTrip, AccountUser } from "./account-server";
import type { HistoricalConditionReplay } from "./historical-replay";

export type CreateFishingTripInput = {
  locationId: string;
  speciesId: string;
  startedAt: string;
  endedAt: string;
  timezone: string;
  anglerCount: number;
  catchCount: number;
  locationDetail: string | null;
  lureOrBait: string | null;
  observedWaterTemperatureC: number | null;
  observedClarity: string | null;
  notes: string | null;
  consentForAggregateAnalysis: boolean;
  candidateCohort: boolean;
};

export async function listD1FishingTrips(user: AccountUser): Promise<AccountFishingTrip[]> {
  const rows = await getDb()
    .select()
    .from(fishingTrips)
    .where(eq(fishingTrips.userEmail, user.email))
    .orderBy(desc(fishingTrips.startedAt));
  return rows.map(normalizeD1Trip);
}

export async function createD1FishingTrip(
  user: AccountUser,
  input: CreateFishingTripInput,
): Promise<AccountFishingTrip> {
  const startedAt = Date.parse(input.startedAt);
  const endedAt = Date.parse(input.endedAt);
  if (!Number.isFinite(startedAt) || !Number.isFinite(endedAt) || endedAt <= startedAt) {
    throw new D1TripError(400, "Trip end time must be after its start time.");
  }
  const effortMinutes = Math.round((endedAt - startedAt) / 60_000);
  if (effortMinutes < 1 || effortMinutes > 10_080) {
    throw new D1TripError(400, "Trip length must be between 1 minute and 7 days.");
  }
  const calibrationEligible = Boolean(
    input.consentForAggregateAnalysis && effortMinutes >= 15,
  );
  const now = new Date().toISOString();
  const [trip] = await getDb().insert(fishingTrips).values({
    id: crypto.randomUUID(),
    userEmail: user.email,
    locationId: input.locationId,
    speciesId: input.speciesId,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    timezone: input.timezone,
    anglerCount: input.anglerCount,
    effortMinutes,
    catchCount: input.catchCount,
    zeroCatchExplicit: input.catchCount === 0,
    locationDetail: input.locationDetail,
    lureOrBait: input.lureOrBait,
    observedWaterTemperatureC: input.observedWaterTemperatureC,
    observedClarity: input.observedClarity,
    notes: input.notes,
    consentForAggregateAnalysis: input.consentForAggregateAnalysis,
    candidateCohort: input.candidateCohort,
    calibrationEligible,
    validationEligible: false,
    updatedAt: now,
  }).returning();
  return normalizeD1Trip(trip);
}

export async function deleteD1FishingTrip(user: AccountUser, tripId: string): Promise<boolean> {
  const removed = await getDb()
    .delete(fishingTrips)
    .where(and(eq(fishingTrips.id, tripId), eq(fishingTrips.userEmail, user.email)))
    .returning({ id: fishingTrips.id });
  return removed.length > 0;
}

export async function getD1FishingTrip(
  user: AccountUser,
  tripId: string,
): Promise<AccountFishingTrip | null> {
  const [row] = await getDb()
    .select()
    .from(fishingTrips)
    .where(and(eq(fishingTrips.id, tripId), eq(fishingTrips.userEmail, user.email)))
    .limit(1);
  return row ? normalizeD1Trip(row) : null;
}

export async function saveD1ConditionReplay(
  user: AccountUser,
  tripId: string,
  replay: HistoricalConditionReplay,
): Promise<AccountFishingTrip | null> {
  const now = new Date().toISOString();
  const [row] = await getDb()
    .update(fishingTrips)
    .set({
      conditionReplayId: replay.replayId,
      conditionReplayStatus: replay.status,
      conditionReplayPolicyVersion: replay.policyVersion,
      conditionReplay: JSON.stringify(replay),
      conditionReplayedAt: replay.reconstructedAt,
      updatedAt: now,
      // Reconstruction never promotes a row into a held-out validation set.
      validationEligible: false,
    })
    .where(and(eq(fishingTrips.id, tripId), eq(fishingTrips.userEmail, user.email)))
    .returning();
  return row ? normalizeD1Trip(row) : null;
}

export { D1TripError } from "./d1-errors";

function normalizeD1Trip(row: typeof fishingTrips.$inferSelect): AccountFishingTrip {
  return {
    id: row.id,
    locationId: row.locationId,
    speciesId: row.speciesId,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    timezone: row.timezone,
    anglerCount: row.anglerCount,
    effortMinutes: row.effortMinutes,
    catchCount: row.catchCount,
    zeroCatchExplicit: row.zeroCatchExplicit,
    locationDetail: row.locationDetail,
    lureOrBait: row.lureOrBait,
    observedWaterTemperatureC: row.observedWaterTemperatureC,
    observedClarity: row.observedClarity,
    notes: row.notes,
    consentForAggregateAnalysis: row.consentForAggregateAnalysis,
    sourceType: "first-party-alpha-trip-log",
    candidateCohort: row.candidateCohort,
    calibrationEligible: row.calibrationEligible,
    validationEligible: row.validationEligible,
    conditionReplayId: row.conditionReplayId,
    conditionReplayStatus: normalizeReplayStatus(row.conditionReplayStatus),
    conditionReplayPolicyVersion: row.conditionReplayPolicyVersion,
    conditionReplay: parseReplay(row.conditionReplay),
    conditionReplayedAt: row.conditionReplayedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function normalizeReplayStatus(value: string): AccountFishingTrip["conditionReplayStatus"] {
  return value === "complete" || value === "partial" || value === "unavailable"
    ? value
    : "not-requested";
}

function parseReplay(value: string | null): HistoricalConditionReplay | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as HistoricalConditionReplay;
  } catch {
    return null;
  }
}
