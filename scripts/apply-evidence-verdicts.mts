/**
 * Enforces adversarial claim rejections on both runtime surfaces.
 *
 * Check only (default):
 *   npx tsx scripts/apply-evidence-verdicts.mts --check
 *
 * Remove rejected claims from the API seed, then check both surfaces:
 *   npx tsx scripts/apply-evidence-verdicts.mts --apply
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { locations } from "../app/lib/data";

type Evidence = { speciesId: string; sourceUrl?: string; evidenceType?: string; modeled?: boolean };
type SeedLocation = { id: string; evidence: Evidence[] };
type Seed = {
  meta: { evidenceCount: number; [key: string]: unknown };
  locations: SeedLocation[];
  [key: string]: unknown;
};
type Verdicts = {
  priorClaimReviews: Array<{
    locationId: string;
    speciesId: string;
    sourceUrl?: string;
    verdict: string;
  }>;
  sourceClaimRejections: Array<{
    sourceUrl: string;
    locationIds: string[];
    rejectedSpeciesIds: string[];
    verdict: string;
  }>;
};

const here = dirname(fileURLToPath(import.meta.url));
const seedPath = resolve(here, "../apps/api/app/data/seed_export.json");
const verdictPath = resolve(here, "../docs/data/fish-community-verdicts.json");
const apply = process.argv.includes("--apply");

const verdicts = JSON.parse(readFileSync(verdictPath, "utf8")) as Verdicts;
const rejectedClaims = [
  ...verdicts.priorClaimReviews
    .filter((review) => review.verdict.startsWith("removed-") || review.verdict.startsWith("rejected-"))
    .map((review) => ({
      locationId: review.locationId,
      speciesId: review.speciesId,
      sourceUrl: review.sourceUrl ?? "",
    })),
  ...verdicts.sourceClaimRejections.flatMap((review) =>
    review.locationIds.flatMap((locationId) =>
      review.rejectedSpeciesIds.map((speciesId) => ({
        locationId,
        speciesId,
        sourceUrl: review.sourceUrl,
      })),
    ),
  ),
];
const rejectionKeys = new Set(
  rejectedClaims.map((claim) => `${claim.locationId}\u0000${claim.speciesId}\u0000${claim.sourceUrl}`),
);

if (rejectionKeys.size !== rejectedClaims.length) {
  throw new Error(`Duplicate rejection triples found: ${rejectedClaims.length - rejectionKeys.size}`);
}

const keyFor = (locationId: string, evidence: Evidence) =>
  `${locationId}\u0000${evidence.speciesId}\u0000${evidence.sourceUrl ?? ""}`;
const isDirect = (evidence: Evidence) => evidence.evidenceType !== "modeled" && !evidence.modeled;
const violationsIn = (surface: Array<{ id: string; evidence: Evidence[] }>) =>
  surface.flatMap((location) =>
    location.evidence
      .filter((evidence) => isDirect(evidence) && rejectionKeys.has(keyFor(location.id, evidence)))
      .map((evidence) => `${location.id}:${evidence.speciesId}:${evidence.sourceUrl ?? "(no source)"}`),
  );

const seed = JSON.parse(readFileSync(seedPath, "utf8")) as Seed;
let removed = 0;
if (apply) {
  for (const location of seed.locations) {
    const before = location.evidence.length;
    location.evidence = location.evidence.filter((evidence) =>
      !isDirect(evidence) || !rejectionKeys.has(keyFor(location.id, evidence))
    );
    removed += before - location.evidence.length;
  }
  seed.meta.evidenceCount = seed.locations.reduce((count, location) => count + location.evidence.length, 0);
  writeFileSync(seedPath, JSON.stringify(seed, null, 2) + "\n", "utf8");
}

const appViolations = violationsIn(locations);
const seedViolations = violationsIn(seed.locations);
if (appViolations.length || seedViolations.length) {
  throw new Error(
    [
      `Rejected evidence is still live (app=${appViolations.length}, apiSeed=${seedViolations.length}).`,
      ...appViolations.map((claim) => `app:${claim}`),
      ...seedViolations.map((claim) => `apiSeed:${claim}`),
    ].join("\n"),
  );
}

console.log(
  `Evidence verdict gate passed: ${rejectionKeys.size} rejected claim triples checked; ${removed} removed from API seed.`,
);
