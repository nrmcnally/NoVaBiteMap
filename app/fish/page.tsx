import { Fish, Info } from "../components/ClientIcons";
import { TopNav } from "../components/TopNav";
import { FishGlossaryClient, type GlossaryFish } from "../components/FishGlossaryClient";
import { locations, species } from "../lib/data";
import { fishImageFor } from "../lib/fish-images";
import { profileFor, topWaterTypes } from "../lib/species-profiles";

export const metadata = {
  title: "Fish guide — BiteMap NOVA",
  description: "Every freshwater species BiteMap tracks in Northern Virginia, with identification, conditions, and where they have evidence.",
};

function evidenceCount(speciesId: string): number {
  return locations.filter((location) => location.evidence.some((e) => e.speciesId === speciesId)).length;
}

// Trim the parenthetical scientific family for a compact grouping label.
function shortFamily(family?: string): string {
  if (!family) return "Other";
  return family.replace(/\s*\(.*\)$/, "").split("/")[0].trim();
}

export default function FishGuidePage() {
  const fish: GlossaryFish[] = species.map((item) => {
    const profile = profileFor(item.id);
    const size =
      profile?.typicalMinInches && profile?.typicalMaxInches
        ? `${profile.typicalMinInches}–${profile.typicalMaxInches} in`
        : "";
    return {
      id: item.id,
      name: item.name,
      scientificName: item.scientificName,
      habitat: item.habitat,
      family: profile?.family ?? "",
      familyShort: shortFamily(profile?.family),
      nativeStatus: (profile?.nativeStatus as GlossaryFish["nativeStatus"]) ?? null,
      typicalSize: size,
      topWater: topWaterTypes(profile),
      evidenceCount: evidenceCount(item.id),
      image: fishImageFor(item.id)?.src ?? null,
    };
  });

  return (
    <div className="app-frame content-page">
      <TopNav active="fish" />
      <main className="content-shell">
        <header className="content-hero">
          <span className="eyebrow"><Fish size={14} /> Species field guide</span>
          <h1>Northern Virginia fish guide</h1>
          <p>Every freshwater species BiteMap tracks in the region. Search or browse, then tap any fish for identification, preferred conditions, size, baits, and the waters where it has evidence.</p>
        </header>

        <div className="fish-guide-note">
          <Info size={15} /> {species.length} species. Facts are researched reference content (primarily Virginia DWR), not a guarantee of presence or catch at any specific water.
        </div>

        <FishGlossaryClient fish={fish} />
      </main>
    </div>
  );
}
