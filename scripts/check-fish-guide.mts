import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { species } from "../app/lib/data";
import { fishImages } from "../app/lib/fish-images";
import { familyGroup, scientificFamily } from "../app/lib/fish-taxonomy";
import { guideProfileFor, profileFor } from "../app/lib/species-profiles";

const here = fileURLToPath(new URL(".", import.meta.url));
const failures: string[] = [];

const ids = species.map((fish) => fish.id);
if (new Set(ids).size !== ids.length) failures.push("Species IDs are not unique.");
const groupByTaxon = new Map<string, Set<string>>();

for (const fish of species) {
  const profile = guideProfileFor(fish.id);
  if (!profile) {
    failures.push(`${fish.id}: missing Fish Guide profile.`);
  } else {
    if (!profile.family?.match(/\([A-Z][a-z]+idae\)$/)) {
      failures.push(`${fish.id}: family must end with a scientific family name in parentheses.`);
    } else {
      const taxon = scientificFamily(profile.family);
      if (taxon) groupByTaxon.set(taxon, new Set([...(groupByTaxon.get(taxon) ?? []), familyGroup(profile.family)]));
    }
    if (!profile.identification) failures.push(`${fish.id}: missing identification guidance.`);
    if (!profile.diet) failures.push(`${fish.id}: missing diet guidance.`);
    if (!profile.sourceUrls?.length) failures.push(`${fish.id}: missing guide source URLs.`);
  }

  const image = fishImages[fish.id];
  if (!image) {
    failures.push(`${fish.id}: missing image registry entry.`);
  } else {
    const diskPath = resolve(here, `../public${image.src}`);
    if (!existsSync(diskPath)) failures.push(`${fish.id}: image file not found at ${image.src}.`);
    else if (statSync(diskPath).size < 5_000) failures.push(`${fish.id}: image file looks empty or truncated.`);
    if (!image.credit || !image.license || !image.sourceUrl) failures.push(`${fish.id}: image attribution is incomplete.`);
  }

  if (!fish.targetable) {
    if (!profile?.guideOnly) failures.push(`${fish.id}: community profile is not marked guideOnly.`);
    if (profileFor(fish.id)) failures.push(`${fish.id}: guide-only species leaked into the bite-scoring profile registry.`);
  }
}

for (const [taxon, labels] of groupByTaxon) {
  if (labels.size !== 1) failures.push(`${taxon}: species split across multiple family groups (${[...labels].join(", ")}).`);
}

if (failures.length) {
  console.error(`Fish Guide audit failed (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

const targetCount = species.filter((fish) => fish.targetable).length;
const communityCount = species.length - targetCount;
console.log(`Fish Guide audit passed: ${species.length} species, ${targetCount} bite-scored, ${communityCount} guide-only, all with profiles and credited images.`);
