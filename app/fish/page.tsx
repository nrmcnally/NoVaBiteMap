import { Fish, Info } from "../components/ClientIcons";
import { TopNav } from "../components/TopNav";
import { FishGlossaryClient, type GlossaryFish } from "../components/FishGlossaryClient";
import { locations, species, targetSpecies } from "../lib/data";
import { fishImageFor } from "../lib/fish-images";
import { guideProfileFor, topWaterTypes } from "../lib/species-profiles";
import { familyGroup } from "../lib/fish-taxonomy";

export const metadata = {
  title: "Fish guide — BiteMap NOVA",
  description: "Every freshwater species BiteMap tracks in Northern Virginia, with identification, conditions, and where they have evidence.",
};

function evidenceCount(speciesId: string): number {
  return locations.filter((location) => location.evidence.some((e) => e.speciesId === speciesId)).length;
}

export default function FishGuidePage() {
  const fish: GlossaryFish[] = species.map((item) => {
    const profile = guideProfileFor(item.id);
    const family = profile?.family ?? item.family;
    const size =
      profile?.typicalMinInches && profile?.typicalMaxInches
        ? `${profile.typicalMinInches}–${profile.typicalMaxInches} in`
        : "";
    return {
      id: item.id,
      name: item.name,
      scientificName: item.scientificName,
      habitat: item.habitat,
      family: family ?? "",
      familyShort: familyGroup(family),
      nativeStatus: (profile?.nativeStatus as GlossaryFish["nativeStatus"]) ?? null,
      typicalSize: size,
      topWater: topWaterTypes(profile),
      evidenceCount: evidenceCount(item.id),
      image: fishImageFor(item.id)?.src ?? null,
      targetable: item.targetable,
    };
  });

  return (
    <div className="app-frame content-page">
      <TopNav active="fish" />
      <main className="content-shell">
        <header className="content-hero">
          <span className="eyebrow"><Fish size={14} /> Species field guide</span>
          <h1>Northern Virginia fish guide</h1>
          <p>Target species and fish-community records supported by BiteMap&apos;s regional evidence. Search or browse, then open a fish to see its habitat and the waters where evidence supports it.</p>
        </header>

        <div className="fish-guide-note">
          <Info size={15} /> {species.length} species tracked: {targetSpecies.length} have dedicated bite-scoring profiles and {species.length - targetSpecies.length} are evidence-backed community records. A nearby historic record is not proof at an access point.
        </div>

        <FishGlossaryClient fish={fish} />
      </main>
    </div>
  );
}
