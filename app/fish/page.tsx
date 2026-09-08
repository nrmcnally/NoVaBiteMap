import { Fish, Info } from "../components/ClientIcons";
import { TopNav } from "../components/TopNav";
import { FishGlossaryClient, type GlossaryFish } from "../components/FishGlossaryClient";
import { locations, species, targetSpecies } from "../lib/data";
import { fishImageFor } from "../lib/fish-images";
import { guideProfileFor, topWaterTypes } from "../lib/species-profiles";
import { familyGroup } from "../lib/fish-taxonomy";

export const metadata = {
  title: "Fish guide — BiteMap NOVA",
  description: "Freshwater fish found across Northern Virginia, with identification, habitat, seasonal patterns, and linked fishing waters.",
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
          <p>Browse freshwater fish found across Northern Virginia. Open a species for identification, habitat, seasonal patterns, and linked fishing waters.</p>
        </header>

        <div className="fish-guide-note">
          <Info size={15} /> {species.length} species tracked: {targetSpecies.length} have bite forecasts and {species.length - targetSpecies.length} are listed as regional fish records. A nearby record does not confirm a fish at every access point.
        </div>

        <FishGlossaryClient fish={fish} />
      </main>
    </div>
  );
}
