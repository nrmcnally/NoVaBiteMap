import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, ArrowRight, Award, ExternalLink, Fish, Info, ShieldAlert, Waves } from "../../components/ClientIcons";
import { TopNav } from "../../components/TopNav";
import { FishFactsPanel } from "../../components/FishFactsPanel";
import { SeasonalChart, TempGauge, WaterTypeFit } from "../../components/FishVisuals";
import { speciesById } from "../../lib/data";
import { localFishFacts, localSpeciesWaters } from "../../lib/fish-facts";
import { fishImageFor } from "../../lib/fish-images";

type FishPageProps = { params: Promise<{ id: string }> };

const NATIVE_LABEL: Record<string, string> = { native: "Native to Virginia", introduced: "Introduced", invasive: "Invasive" };

export default async function FishPage({ params }: FishPageProps) {
  const { id } = await params;
  const local = speciesById(id);
  if (!local) notFound();

  // Rendered entirely from bundled data so the guide works without the backend.
  const facts = localFishFacts(id);
  const locations = localSpeciesWaters(id);
  const disclaimer = local.targetable
    ? "Species facts are researched reference content, not a guarantee of presence or catch at any specific water."
    : "Community records describe agency-supported or nearby historic occurrence evidence. They are not access-point surveys, abundance estimates, or bite forecasts.";

  const name = local.name;
  const scientificName = local.scientificName;
  const habitat = facts?.habitat ?? local.habitat ?? null;
  const image = fishImageFor(id);
  const topWaters = locations;
  const guideOnly = !local.targetable;

  return (
    <div className="app-frame detail-page">
      <TopNav active="fish" />
      <main className="detail-shell">
        <Link href="/fish" className="back-link"><ArrowLeft size={16} /> Back to fish guide</Link>

        <header className="detail-hero fish-hero">
          <div>
            <div className="hero-tags">
              <span><Fish size={14} /> Species guide</span>
              {!local.targetable && <span className="community-badge">Community record · not bite-scored</span>}
              {facts?.nativeStatus && (
                <span className={`native-badge native-${facts.nativeStatus}`}>{NATIVE_LABEL[facts.nativeStatus]}</span>
              )}
              {(facts?.family ?? local.family) && <span className="verified-pill">{facts?.family ?? local.family}</span>}
            </div>
            <h1>{name}</h1>
            <p><em>{scientificName}</em></p>
            {habitat && <p className="fish-hero-habitat">{habitat}</p>}
            {facts?.statusNote && <p className="fish-status-note">{facts.statusNote}</p>}
          </div>
          {image && (
            <figure className="fish-hero-photo">
              <img src={image.src} alt={name} />
              <figcaption><a href={image.sourceUrl} target="_blank" rel="noreferrer">{image.credit}</a> · {image.license}</figcaption>
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
                          {other ? <Link href={`/fish/${other.id}`}>{other.name}</Link> : <strong>{c.speciesId}</strong>} — {c.tell}
                        </p>
                      );
                    })}
                  </div>
                )}
              </article>
            )}

            {facts ? (
              <article>
                <div className="section-heading"><div><span className="eyebrow">Field guide</span><h2>{guideOnly ? "Biology, size & habitat" : "Conditions, size & presentation"}</h2></div></div>
                <div className="fish-viz-row">
                  <SeasonalChart data={facts.seasonalActivityByMonth} guideOnly={guideOnly} />
                  <TempGauge preferred={facts.preferredTempF} tolerance={facts.toleranceTempF} />
                  <WaterTypeFit pref={facts.waterbodyPreference} />
                </div>
                <FishFactsPanel facts={facts} variant="page" guideOnly={guideOnly} />
                {facts.diet && <p className="fish-diet"><Fish size={13} /> <strong>Diet:</strong> {facts.diet}</p>}
              </article>
            ) : (
              <article className="fish-id-card">
                <span className="eyebrow">Fish-community reference</span>
                <p>This species is tracked because it appears in the regional evidence, but it does not yet have a reviewed bite-scoring profile. BiteMap shows its verified taxonomy, broad habitat, and supporting waters without inventing activity, size, or lure guidance.</p>
              </article>
            )}

            {facts && (facts.techniquesBySeason.cold || facts.techniquesBySeason.cool || facts.techniquesBySeason.warm) && (
              <article className="fish-technique-card">
                <div className="section-heading"><div><span className="eyebrow">Seasonal approach</span><h2>{guideOnly ? "How anglers encounter it" : "How to target it through the year"}</h2></div></div>
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
                <div><span className="eyebrow">{guideOnly ? "Where it has evidence" : "Where to fish for it"}</span><h2>{locations.length > 0 ? `${locations.length} evidenced water${locations.length === 1 ? "" : "s"}` : "No evidenced waters yet"}</h2></div>
                {locations.length > 0 && local.targetable && <Link className="see-on-map" href={`/?species=${id}`}>See on map <ArrowRight size={13} /></Link>}
              </div>
              {topWaters.length > 0 ? (
                <div className="fish-location-scroll">
                  <div className="fish-location-list ranked">
                    {topWaters.map((loc) => (
                      <Link key={loc.id} href={`/locations/${loc.id}?species=${id}`} className={`fish-rank-row rank-${loc.state}`}>
                        <span className={`fish-rank-orb orb-${loc.state}`}>{loc.opportunityScore}</span>
                        <span className="fish-loc-name">{loc.name}
                          <small>{loc.waterbody} · {loc.county}{loc.modeled ? " · inferred" : ""}</small>
                        </span>
                        <span className="fish-rank-conf">{loc.confidenceLabel}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="fish-empty">BiteMap has no location that clears the evidence gate for this species yet. That is not evidence the fish is absent from the region.</p>
              )}
              {locations.length > 0 && <small className="fish-where-note">{local.targetable ? "Ranked by estimated opportunity (documented waters first). Live conditions refine each score on the spot page." : "Ordered by evidence strength, with documented waters before nearby modeled records. Scores here describe presence support, not bite quality."} Scroll for more.</small>}
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
              {local.targetable && <a href="https://dwr.virginia.gov/fishing/trophy-fish/" target="_blank" rel="noreferrer">DWR Trophy Fish / citation program <ExternalLink size={13} /></a>}
            </section>

            <section className="fish-disclaimer-card">
              <p><Info size={14} /> {disclaimer}</p>
            </section>
          </aside>
        </section>
      </main>
    </div>
  );
}
