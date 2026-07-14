import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Fish, Info, MapPin, ShieldAlert } from "../../components/ClientIcons";
import { TopNav } from "../../components/TopNav";
import { FishFactsPanel } from "../../components/FishFactsPanel";
import { fetchSpecies } from "../../lib/api";
import { speciesById } from "../../lib/data";
import { fishImageFor } from "../../lib/fish-images";

type FishPageProps = { params: Promise<{ id: string }> };

const EVIDENCE_LABEL: Record<string, string> = {
  "official listing": "Official listing",
  "agency survey": "Agency survey",
  stocking: "Stocked-water designation",
  modeled: "Nearby / modeled",
};

export default async function FishPage({ params }: FishPageProps) {
  const { id } = await params;
  const local = speciesById(id);
  const detail = await fetchSpecies(id);

  if (!detail && !local) notFound();

  const name = detail?.name ?? local?.name ?? id;
  const scientificName = detail?.scientificName ?? local?.scientificName ?? "";
  const habitat = detail?.facts?.habitat ?? local?.habitat ?? null;
  const facts = detail?.facts ?? null;
  const locations = detail?.locations ?? [];
  const image = fishImageFor(id);

  return (
    <div className="app-frame detail-page">
      <TopNav active="fish" />
      <main className="detail-shell">
        <a href="/fish" className="back-link"><ArrowLeft size={16} /> Back to fish guide</a>

        <header className="detail-hero fish-hero">
          <div>
            <div className="hero-tags">
              <span><Fish size={14} /> Species guide</span>
              {facts?.confidence && <span className="verified-pill">Profile confidence: {facts.confidence}</span>}
            </div>
            <h1>{name}</h1>
            <p><em>{scientificName}</em></p>
            {habitat && <p className="fish-hero-habitat">{habitat}</p>}
          </div>
          {image && (
            <figure className="fish-hero-photo">
              <img src={image.src} alt={name} />
              <figcaption>{image.credit} · {image.license}</figcaption>
            </figure>
          )}
        </header>

        <section className="detail-grid">
          <div className="detail-main">
            {facts?.identification && (
              <article className="fish-id-card">
                <span className="eyebrow">How to identify it</span>
                <p>{facts.identification}</p>
              </article>
            )}

            {facts ? (
              <article>
                <div className="section-heading"><div><span className="eyebrow">Field guide</span><h2>Conditions, size &amp; presentation</h2></div></div>
                <FishFactsPanel facts={facts} variant="page" />
              </article>
            ) : (
              <article className="fish-id-card">
                <span className="eyebrow">Field guide</span>
                <p>Detailed species facts are temporarily unavailable. Basic identification and the waters where BiteMap has evidence are shown below.</p>
              </article>
            )}

            {facts && (facts.techniquesBySeason.cold || facts.techniquesBySeason.cool || facts.techniquesBySeason.warm) && (
              <article className="fish-technique-card">
                <div className="section-heading"><div><span className="eyebrow">Seasonal approach</span><h2>How to target it through the year</h2></div></div>
                <div className="fish-season-columns">
                  {facts.techniquesBySeason.cold && <div><h3>Cold water</h3><p>{facts.techniquesBySeason.cold}</p></div>}
                  {facts.techniquesBySeason.cool && <div><h3>Cool water</h3><p>{facts.techniquesBySeason.cool}</p></div>}
                  {facts.techniquesBySeason.warm && <div><h3>Warm water</h3><p>{facts.techniquesBySeason.warm}</p></div>}
                </div>
              </article>
            )}
          </div>

          <aside className="detail-aside">
            <section>
              <span className="eyebrow">Where to fish for it</span>
              <h2>{locations.length > 0 ? `${locations.length} water${locations.length === 1 ? "" : "s"} with evidence` : "No evidenced waters yet"}</h2>
              {locations.length > 0 ? (
                <div className="fish-location-list">
                  {locations.slice(0, 20).map((loc) => (
                    <a key={loc.id} href={`/locations/${loc.id}?species=${id}`}>
                      <span className="fish-loc-name"><MapPin size={13} /> {loc.name}</span>
                      <span className="fish-loc-meta">
                        {loc.waterbody} · {loc.county}
                        <small>{EVIDENCE_LABEL[loc.evidenceType] ?? loc.evidenceType}{loc.modeled ? " (nearby)" : ""}</small>
                      </span>
                    </a>
                  ))}
                </div>
              ) : (
                <p className="fish-empty">BiteMap has no location that clears the evidence gate for this species yet. That is not evidence the fish is absent from the region.</p>
              )}
            </section>

            <section className="safety-panel">
              <h3><ShieldAlert size={19} /> Regulations &amp; harvest</h3>
              <p>Size, creel, and season limits vary by water, season, and method. Always confirm the current rules before keeping fish.</p>
              <a href="https://dwr.virginia.gov/fishing/regulations/" target="_blank" rel="noreferrer">Virginia fishing regulations <ExternalLink size={13} /></a>
              <a href="https://dwr.virginia.gov/fishing/trophy-fish/" target="_blank" rel="noreferrer">DWR Trophy Fish / citation program <ExternalLink size={13} /></a>
            </section>

            {detail?.disclaimer && (
              <section className="fish-disclaimer-card">
                <p><Info size={14} /> {detail.disclaimer}</p>
              </section>
            )}
          </aside>
        </section>
      </main>
    </div>
  );
}
