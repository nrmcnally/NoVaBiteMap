import { inArray } from "drizzle-orm";
import { getDb } from "../../db";
import { hydrologyNodeElevations } from "../../db/schema";

export type HydrologyNodeElevation = {
  locationId: string;
  elevationFeet: number;
  resolutionMeters: number | null;
  source: string;
  sourceUrl: string;
  sampledAt: string;
};

export async function listD1HydrologyNodeElevations(locationIds: string[]): Promise<HydrologyNodeElevation[]> {
  if (!locationIds.length) return [];
  return getDb().select().from(hydrologyNodeElevations).where(inArray(hydrologyNodeElevations.locationId, locationIds));
}

export async function upsertD1HydrologyNodeElevation(value: HydrologyNodeElevation): Promise<void> {
  await getDb().insert(hydrologyNodeElevations).values(value).onConflictDoUpdate({
    target: hydrologyNodeElevations.locationId,
    set: {
      elevationFeet: value.elevationFeet,
      resolutionMeters: value.resolutionMeters,
      source: value.source,
      sourceUrl: value.sourceUrl,
      sampledAt: value.sampledAt,
    },
  });
}
