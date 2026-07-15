/**
 * Fails when the checked-in API seed no longer matches the frontend's audited
 * TypeScript assembly. Run `npx tsx scripts/export-seed.mts` to refresh it.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { locations, species } from "../app/lib/data";
import { hydrologyAssociations } from "../app/lib/hydrology";

const here = dirname(fileURLToPath(import.meta.url));
const seedPath = resolve(here, "../apps/api/app/data/seed_export.json");
const seed = JSON.parse(readFileSync(seedPath, "utf8")) as {
  meta: {
    generatedFrom: string;
    schemaVersion: string;
    locationCount: number;
    speciesCount: number;
    evidenceCount: number;
    stationCount: number;
  };
  species: unknown[];
  stations: unknown[];
  locations: unknown[];
};

const stations = new Map<string, { stationId: string; stationName: string; monitorUrl: string }>();
for (const association of Object.values(hydrologyAssociations)) {
  stations.set(association.stationId, {
    stationId: association.stationId,
    stationName: association.stationName,
    monitorUrl: association.monitorUrl,
  });
}

const expectedMeta = {
  generatedFrom: "app/lib/data.ts",
  schemaVersion: "1.0",
  locationCount: locations.length,
  speciesCount: species.length,
  evidenceCount: locations.reduce((total, location) => total + location.evidence.length, 0),
  stationCount: stations.size,
};

const registeredSpeciesIds = new Set(species.map((item) => item.id));
const unknownEvidenceSpeciesIds = [...new Set(
  locations.flatMap((location) => location.evidence.map((evidence) => evidence.speciesId)),
)].filter((speciesId) => !registeredSpeciesIds.has(speciesId));
if (unknownEvidenceSpeciesIds.length > 0) {
  throw new Error(`Fish guide/species registry is missing evidenced species: ${unknownEvidenceSpeciesIds.join(", ")}`);
}

const assertEqual = (label: string, actual: unknown, expected: unknown) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label} is stale. Run: npx tsx scripts/export-seed.mts`);
  }
};

assertEqual("Seed metadata", seed.meta, expectedMeta);
assertEqual("Seed species", seed.species, species);
assertEqual("Seed stations", seed.stations, [...stations.values()]);
assertEqual("Seed locations/evidence", seed.locations, locations);

console.log(
  `Seed parity passed: ${locations.length} locations and ${expectedMeta.evidenceCount} evidence records match.`,
);
