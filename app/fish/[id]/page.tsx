import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, ArrowRight, Award, ExternalLink, Fish, Info, MapPin, ShieldAlert, Waves } from "../../components/ClientIcons";
import { TopNav } from "../../components/TopNav";
import { FishFactsPanel } from "../../components/FishFactsPanel";
import { SeasonalChart, TempGauge, WaterTypeFit } from "../../components/FishVisuals";
import { fetchSpecies } from "../../lib/api";
import { speciesById } from "../../lib/data";
import { fishImageFor } from "../../lib/fish-images";

type FishPageProps = { params: Promise<{ id: string }> };

const NATIVE_LABEL: Record<string, string> = { native: "Native to Virginia", introduced: "Introduced", invasive: "Invasive" };

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
  const topWaters = locations.slice(0, 20);

  return (
    <div className="app-frame detail-page">
      <TopNav active="fish" />
      <main className="detail-shell">
        <a href="/fish" className="back-link"><ArrowLeft size={16} /> Back to fish guide</a>

        <header className="detail-hero fish-hero">
          <div>
            <div className="hero-tags">
              <span><Fish size={14} /> Species guide</span>
              {facts?.nativeStatus && (
                <span className={`native-badge native-${facts.nativeStatus}`}>{NATIVE_LABEL[facts.nativeStatus]}</span>
              )}
              {facts?.family && <span className="verified-pill">{facts.family}</span>}
            </div>
            <h1>{name}</h1>
            <p><em>{scientificName}</em></p>
            {habitat && <p className="fish-hero-habitat">{habitat}</p>}
            {facts?.statusNote && <p className="fish-status-note">{facts.statusNote}</p>}
          </div>
          {image && (
            <figure className="fish-hero-photo">
              <img src={image.src} alt={name} />
              <figcaption>{image.credit} · {image.license}</figcaption>
            </figure>
          )}
        </header>

        {facts?.nativeStatus === "invasive" && facts.handlingNote && (
          <div className="invasive-banner"><AlertTriangle size={16} /> <span>{facts.handlingNote}</span></div>
        )}

        <section className="detail-grid">
          <div className="detail-main">
            {facts?.identification && (
              <article className="fish-id-card">
                <span className="eyebrow">How to identify it</span>
                <p>{facts.identification}</p>
                {facts.confusedWith.length > 0 && (
                  <div className="confused-with">
                    <h4>Often confused with</h4>
                    {facts.confusedWith.map((c) => {
                      const other = speciesById(c.speciesId);
                      return (
                        <p key={c.speciesId}>
                          {other ? <a href={`/fish/${other.id}`}>{other.name}</a> : <strong>{c.speciesId}</strong>} — {c.tell}
                        </p>
                      );
                    })}
                  </div>
                )}
              </article>
            )}

            {facts ? (
              <article>
                <div className="section-heading"><div><span className="eyebrow">Field guide</span><h2>Conditions, size &amp; presentation</h2></div></div>
                <div className="fish-viz-row">
                  <SeasonalChart data={facts.seasonalActivityByMonth} />
                  <TempGauge preferred={facts.preferredTempF} tolerance={facts.toleranceTempF} />
                  <WaterTypeFit pref={facts.waterbodyPreference} />
                </div>
                <FishFactsPanel facts={facts} variant="page" />
                {facts.diet && <p className="fish-diet"><Fish size={13} /> <strong>Diet:</strong> {facts.diet}</p>}
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

            {facts?.handlingNote && facts.nativeStatus !== "invasive" && (
              <article className="fish-handling-card">
                <div className="technique-icon"><Waves size={24} /></div>
                <div><span className="eyebrow">Conservation &amp; handling</span><p>{facts.handlingNote}</p></div>
              </article>
            )}
          </div>

          <aside className="detail-aside">
            <section>
              <div className="fish-where-heading">
                <div><span className="eyebrow">Where to fish for it</span><h2>{locations.length > 0 ? `${locations.length} evidenced water${locations.length === 1 ? "" : "s"}` : "No evidenced waters yet"}</h2></div>
                {locations.length > 0 && <a className="see-on-map" href={`/?species=${id}`}>See on map <ArrowRight size={13} /></a>}
              </div>
              {topWaters.length > 0 ? (
                <div className="fish-location-list ranked">
                  {topWaters.map((loc) => (
                    <a key={loc.id} href={`/locations/${loc.id}?species=${id}`} className={`fish-rank-row rank-${loc.state}`}>
                      <span className={`fish-rank-orb orb-${loc.state}`}>{loc.opportunityScore}</span>
                      <span className="fish-loc-name">{loc.name}
                        <small>{loc.waterbody} · {loc.county}{loc.modeled ? " · inferred" : ""}</small>
                      </span>
                      <span className="fish-rank-conf">{loc.confidenceLabel}</span>
                    </a>
                  ))}
                </div>
              ) : (
                <p className="fish-empty">BiteMap has no location that clears the evidence gate for this species yet. That is not evidence the fish is absent from the region.</p>
              )}
              {locations.length > 0 && <small className="fish-where-note">Ranked by today&apos;s estimated opportunity (documented waters first). Live conditions refine each score on the spot page.</small>}
            </section>

            {facts?.stateRecordLb && (
              <section className="fish-record-card">
                <Award size={20} />
                <div><span className="eyebrow">Virginia state record</span><strong>{facts.stateRecordLb} lb</strong></div>
              </section>
            )}

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
