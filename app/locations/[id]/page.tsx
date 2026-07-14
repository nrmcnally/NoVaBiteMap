import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Sailboat,
  CheckCircle2,
  Clock3,
  Droplets,
  ExternalLink,
  Fish,
  Footprints,
  Gauge,
  Heart,
  Info,
  MapPin,
  Navigation,
  ShieldAlert,
  Waves,
} from "../../components/ClientIcons";
import { TopNav } from "../../components/TopNav";
import { locationById, sourceLinks, speciesById } from "../../lib/data";
import { estimatedHourlyScores, opportunityFor } from "../../lib/scoring";
import { googleDirectionsUrl } from "../../lib/travel";

type LocationPageProps = { params: Promise<{ id: string }> };

export default async function LocationPage({ params }: LocationPageProps) {
  const { id } = await params;
  const location = locationById(id);
  if (!location) notFound();

  const primaryEvidence = location.evidence[0];
  const opportunity = primaryEvidence ? opportunityFor(location, primaryEvidence.speciesId) : null;
  const target = primaryEvidence ? speciesById(primaryEvidence.speciesId) : null;
  const hourly = opportunity ? estimatedHourlyScores(opportunity.score) : [];

  return (
    <div className="app-frame detail-page">
      <TopNav active="explore" />
      <main className="detail-shell">
        <a href="/" className="back-link"><ArrowLeft size={16} /> Back to opportunity map</a>

        <header className="detail-hero">
          <div>
            <div className="hero-tags">
              <span><MapPin size={14} /> {location.county} County, Virginia</span>
              <span className="verified-pill">Verified by {location.accessAuthority}</span>
            </div>
            <h1>{location.name}</h1>
            <p>{location.waterbody} · {location.waterbodyType} · Public access point</p>
            <div className="hero-access">
              {location.access.map((method) => (
                <span key={method}>
                  {method === "boat" || method === "kayak" ? <Sailboat size={15} /> : <Footprints size={15} />}
                  {method}
                </span>
              ))}
            </div>
          </div>
          <div className="hero-actions">
            <a href={googleDirectionsUrl(location)} target="_blank" rel="noreferrer">
              <Navigation size={17} /> Google Maps directions
            </a>
            <a href="/my-spots"><Heart size={17} /> Save spot</a>
          </div>
        </header>

        <section className="detail-grid">
          <div className="detail-main">
            {opportunity && target ? (
              <article className="outlook-card">
                <div className="outlook-topline">
                  <div>
                    <span className="eyebrow">Today · evidence + seasonal estimate</span>
                    <h2>{target.name} outlook</h2>
                  </div>
                  <div className="large-score"><strong>{opportunity.score}</strong><span>/100<br />opportunity</span></div>
                </div>
                <div className="outlook-summary">
                  <div><Clock3 size={19} /><span>Best window<strong>{location.bestWindow}</strong></span></div>
                  <div><Gauge size={19} /><span>Confidence<strong>{opportunity.confidenceLabel} · {opportunity.confidence}%</strong></span></div>
                  <div><Fish size={19} /><span>Presence support<strong>{Math.round(opportunity.availability * 100)}/100</strong></span></div>
                </div>
                <div className="basis-banner"><Info size={16} /> Hourly activity is an estimated seasonal profile until NWS and verified hydrology associations refresh. It is not an observed catch rate.</div>
              </article>
            ) : (
              <article className="outlook-card no-evidence">
                <ShieldAlert size={30} />
                <div><span className="eyebrow">Evidence gate active</span><h2>No species outlook yet</h2><p>{location.notice}</p></div>
              </article>
            )}

            {opportunity && (
              <article className="chart-card">
                <div className="section-heading">
                  <div><span className="eyebrow">Hour by hour</span><h2>When the profile is strongest</h2></div>
                  <span className="estimated-badge">Estimated</span>
                </div>
                <div className="hour-chart" aria-label="Estimated hourly opportunity chart">
                  {hourly.map((hour) => (
                    <div className="hour-column" key={hour.label}>
                      <span>{hour.score}</span>
                      <div><i style={{ height: `${Math.max(12, hour.score)}%` }} /></div>
                      <strong>{hour.label}</strong>
                    </div>
                  ))}
                </div>
                <div className="chart-caption"><span /> Strongest modeled window <small>Profile v1.0 · local time (America/New_York)</small></div>
              </article>
            )}

            {primaryEvidence && (
              <article className="factors-card">
                <div className="section-heading"><div><span className="eyebrow">Explain the score</span><h2>What moved this outlook</h2></div></div>
                <div className="factor-columns">
                  <div className="positive-factors">
                    <h3><CheckCircle2 size={18} /> Positive factors</h3>
                    {primaryEvidence.positive.map((factor) => <p key={factor}><span>+</span>{factor}</p>)}
                    <p><span>+</span>Public access coordinates are agency verified</p>
                  </div>
                  <div className="negative-factors">
                    <h3><AlertTriangle size={18} /> Limiting factors</h3>
                    {primaryEvidence.negative.map((factor) => <p key={factor}><span>−</span>{factor}</p>)}
                    <p><span>−</span>Forecasts cannot guarantee a catch</p>
                  </div>
                </div>
              </article>
            )}

            {primaryEvidence && (
              <article className="technique-card">
                <div className="technique-icon"><Fish size={26} /></div>
                <div><span className="eyebrow">Practical starting point</span><h2>{primaryEvidence.technique}</h2><p>{primaryEvidence.depth}. Adjust to actual clarity, flow, structure, and posted rules.</p></div>
              </article>
            )}
          </div>

          <aside className="detail-aside">
            <section>
              <span className="eyebrow">Access intelligence</span>
              <h2>Before you go</h2>
              <dl>
                <div><dt>Coordinates</dt><dd>{location.lat.toFixed(5)}, {location.lng.toFixed(5)}</dd></div>
                <div><dt>Drive estimate</dt><dd>{location.travelMinutes} min · {location.distanceMiles} mi</dd></div>
                <div><dt>Water status</dt><dd>{location.flowStatus}</dd></div>
                <div><dt>Public access</dt><dd>Verified by {location.accessAuthority}</dd></div>
              </dl>
            </section>
            <section className="safety-panel">
              <h3><ShieldAlert size={19} /> Safety & access note</h3>
              <p>{location.notice}</p>
              <p>Do not wade rising water. Check severe weather, closures, and posted property boundaries.</p>
            </section>
            <section>
              <span className="eyebrow">Source trail</span>
              <h2>Why you can trust it</h2>
              <a href={location.accessSourceUrl} target="_blank" rel="noreferrer">{location.accessAuthority} access source <ExternalLink size={14} /></a>
              {primaryEvidence?.sourceUrl && <a href={primaryEvidence.sourceUrl} target="_blank" rel="noreferrer">{primaryEvidence.sourceName ?? "Official species evidence"} <ExternalLink size={14} /></a>}
              {location.waterbody.includes("Shenandoah") && <a href={sourceLinks.shenandoah} target="_blank" rel="noreferrer">DWR regional fishery feature <ExternalLink size={14} /></a>}
              {location.id === "lake-brittle" && <a href={sourceLinks.walleye2026} target="_blank" rel="noreferrer">2026 DWR Walleye Forecast <ExternalLink size={14} /></a>}
              <a href="/methodology">Read the scoring methodology <ExternalLink size={14} /></a>
              <small>Access source reviewed {location.sourceReviewed}. Always verify current regulations with the official authority.</small>
            </section>
            <section className="condition-mini">
              <div><Waves size={18} /><span>Hydrology<strong>Association pending</strong></span></div>
              <div><Droplets size={18} /><span>Water temperature<strong>Unavailable</strong></span></div>
            </section>
          </aside>
        </section>
      </main>
    </div>
  );
}
