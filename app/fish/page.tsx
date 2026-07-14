import Link from "next/link";
import { ArrowRight, Fish, Info } from "../components/ClientIcons";
import { TopNav } from "../components/TopNav";
import { locations, species } from "../lib/data";
import { fishImageFor } from "../lib/fish-images";

export const metadata = {
  title: "Fish guide — BiteMap NOVA",
  description: "Every freshwater species BiteMap tracks in Northern Virginia, with identification, conditions, and where they have evidence.",
};

function evidenceCount(speciesId: string): number {
  return locations.filter((location) => location.evidence.some((e) => e.speciesId === speciesId)).length;
}

export default function FishGuidePage() {
  const sorted = [...species].sort((a, b) => a.name.localeCompare(b.name));
  const groups = new Map<string, typeof sorted>();
  for (const fish of sorted) {
    const letter = fish.name[0].toUpperCase();
    groups.set(letter, [...(groups.get(letter) ?? []), fish]);
  }

  return (
    <div className="app-frame content-page">
      <TopNav active="fish" />
      <main className="content-shell">
        <header className="content-hero">
          <span className="eyebrow"><Fish size={14} /> Species field guide</span>
          <h1>Northern Virginia fish guide</h1>
          <p>Every freshwater species BiteMap tracks in the region. Tap any fish for identification, preferred conditions, size, baits, and the waters where it has evidence.</p>
        </header>

        <div className="fish-guide-note">
          <Info size={15} /> {species.length} species. Facts are researched reference content (primarily Virginia DWR), not a guarantee of presence or catch at any specific water.
        </div>

        <div className="fish-guide-index" aria-hidden="true">
          {[...groups.keys()].map((letter) => (
            <a key={letter} href={`#letter-${letter}`}>{letter}</a>
          ))}
        </div>

        {[...groups.entries()].map(([letter, fish]) => (
          <section key={letter} className="fish-guide-group" id={`letter-${letter}`}>
            <h2 className="fish-guide-letter">{letter}</h2>
            <div className="fish-guide-grid">
              {fish.map((item) => {
                const image = fishImageFor(item.id);
                const count = evidenceCount(item.id);
                return (
                  <Link key={item.id} href={`/fish/${item.id}`} className="fish-guide-card">
                    <div className="fish-guide-thumb">
                      {image ? (
                        <img src={image.src} alt={item.name} loading="lazy" />
                      ) : (
                        <span className="fish-guide-thumb-placeholder"><Fish size={26} /></span>
                      )}
                    </div>
                    <div className="fish-guide-card-body">
                      <h3>{item.name}</h3>
                      <p className="fish-guide-sci"><em>{item.scientificName}</em></p>
                      <p className="fish-guide-habitat">{item.habitat}</p>
                      <span className="fish-guide-evidence">
                        {count > 0 ? `${count} water${count === 1 ? "" : "s"} with evidence` : "No evidenced waters yet"}
                        <ArrowRight size={13} />
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
