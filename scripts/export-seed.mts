/**
 * Exports the audited TypeScript seed dataset (app/lib/data.ts assembly) to a
 * normalized JSON snapshot the FastAPI loader ingests into PostGIS/SQLite.
 *
 * This keeps ONE human-editable source of truth (the reviewed TS dataset) while
 * making the database the runtime authority. Regenerate after editing app/lib:
 *   npx tsx scripts/export-seed.mts
 */
import { writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { locations, species } from "../app/lib/data";
import { hydrologyAssociations } from "../app/lib/hydrology";

const here = dirname(fileURLToPath(import.meta.url));
const outPath = resolve(here, "../apps/api/app/data/seed_export.json");

// Distinct stations referenced by any association (for the hydrology_stations table).
const stations = new Map<string, { stationId: string; stationName: string; monitorUrl: string }>();
for (const assoc of Object.values(hydrologyAssociations)) {
  stations.set(assoc.stationId, {
    stationId: assoc.stationId,
    stationName: assoc.stationName,
    monitorUrl: assoc.monitorUrl,
  });
}

const payload = {
  meta: {
    generatedFrom: "app/lib/data.ts",
    schemaVersion: "1.0",
    locationCount: locations.length,
    speciesCount: species.length,
    evidenceCount: locations.reduce((total, loc) => total + loc.evidence.length, 0),
    stationCount: stations.size,
  },
  species,
  stations: [...stations.values()],
  locations,
};

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf-8");

// Publish the researched species profiles to the frontend bundle so the fish
// guide/glossary can render reference content without an API round-trip.
const profilesSrc = resolve(here, "../apps/api/app/data/species_profiles.json");
const profilesDest = resolve(here, "../app/lib/generated/species-profiles.json");
copyFileSync(profilesSrc, profilesDest);

console.log(
  `Exported ${locations.length} locations, ${species.length} species, ` +
    `${payload.meta.evidenceCount} evidence records, ${stations.size} stations -> ${outPath}`,
);
