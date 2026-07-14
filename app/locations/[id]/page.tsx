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
import { LocationIntelligence } from "../../components/LocationIntelligence";
import { consumptionAdviceFor } from "../../lib/advisories";
import { locationById, sourceLinks, speciesById } from "../../lib/data";
import { estimatedHourlyScores, opportunityFor } from "../../lib/scoring";
import { googleDirectionsUrl } from "../../lib/travel";

type LocationPageProps = { params: Promise<{ id: string }>; searchParams: Promise<{ species?: string }> };

export default async function LocationPage({ params, searchParams }: LocationPageProps) {
  const { id } = await params;
  const { species: speciesQuery } = await searchParams;
  const location = locationById(id);
  if (!location) notFound();

  const advisorySpeciesIds = (speciesQuery ?? "").split(",").filter((speciesId) => Boolean(speciesById(speciesId)));
  const consumptionAdvisory = consumptionAdviceFor(location.consumptionAdvisory, advisorySpeciesIds);
  const advisorySpeciesNames = advisorySpeciesIds.map((speciesId) => speciesById(speciesId)?.name).filter(Boolean);

  const primaryEvidence = advisorySpeciesIds
    .map((speciesId) => location.evidence.find((evidence) => evidence.speciesId === speciesId))
    .find(Boolean) ?? location.evidence[0];
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
                    <span className="eyebrow">Evidence baseline · live outlook below</span>
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

            {opportunity && target && (
              <LocationIntelligence
                locationId={location.id}
                latitude={location.lat}
                longitude={location.lng}
                speciesName={target.name}
                availability={opportunity.availability}
                quality={opportunity.quality}
                accessFit={opportunity.accessFit}
                baseConfidence={opportunity.confidence}
                associationFactor={location.hydrology?.associationFactor ?? 1}
                hydrologyRelevant={location.waterbodyType === "river" || location.waterbodyType === "stream"}
                wadingAvailable={location.access.includes("wade")}
                fallbackHourly={hourly}
              />
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
            <section className={`consumption-panel consumption-${consumptionAdvisory.status}`}>
              <div className="consumption-heading">
                {consumptionAdvisory.status === "active" ? <AlertTriangle size={20} /> : consumptionAdvisory.status === "jurisdiction-check" ? <Info size={20} /> : <CheckCircle2 size={20} />}
                <div><span className="eyebrow">{advisorySpeciesNames.length > 0 ? `${advisorySpeciesNames.join(", ")} guidance` : "Fish consumption guidance"}</span><h2>{consumptionAdvisory.label}</h2></div>
              </div>
              <p>{consumptionAdvisory.summary}</p>
              {consumptionAdvisory.contaminants.length > 0 && (
                <div className="contaminant-list">
                  {consumptionAdvisory.contaminants.map((contaminant) => <span key={contaminant}>{contaminant}</span>)}
                </div>
              )}
              {consumptionAdvisory.segments.map((segment) => {
                const relevantRestrictions = advisorySpeciesIds.length === 0
                  ? segment.restrictions
                  : segment.restrictions.filter((restriction) => consumptionAdvisory.matchingRestrictions.some((match) => match.id === restriction.id));
                return (
                  <div className="advisory-segment" key={segment.id}>
                    <strong>{segment.waterbody}</strong>
                    <p>{segment.section}</p>
                    {relevantRestrictions.length > 0 ? (
                      <div className="restriction-list">
                        {relevantRestrictions.map((restriction) => (
                          <div className={`restriction-row restriction-${restriction.severity}`} key={restriction.id}>
                            <span>{restriction.label}</span>
                            <strong>{restriction.speciesLabel}{restriction.sizeQualifier ? ` · ${restriction.sizeQualifier}` : ""}</strong>
                            <small>{restriction.contaminant}</small>
                          </div>
                        ))}
                      </div>
                    ) : <small>No restriction in this segment names the selected species.</small>}
                    <a href={segment.sourceUrl} target="_blank" rel="noreferrer">{segment.sourceVersion} <ExternalLink size={14} /></a>
                  </div>
                );
              })}
              <a href={consumptionAdvisory.sourceUrl} target="_blank" rel="noreferrer">
                Check the complete current VDH advisory table <ExternalLink size={14} />
              </a>
              <small>Reviewed {consumptionAdvisory.reviewed}. One meal is eight ounces. VDH advises pregnant or potentially pregnant people, nursing mothers, and young children not to eat any fish listed in an advisory. No mapped match is a safety guarantee.</small>
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
              <div><Waves size={18} /><span>Hydrology<strong>{location.hydrology ? `USGS ${location.hydrology.stationId} linked` : "No verified association"}</strong></span></div>
              <div><Droplets size={18} /><span>Water temperature<strong>{location.hydrology ? "Shown when station reports it" : "No verified station"}</strong></span></div>
            </section>
            {location.stocking && (
              <section>
                <span className="eyebrow">Official stocking record</span>
                <h2>DWR category {location.stocking.category}</h2>
                <p>{location.stocking.speciesIds.map((speciesId) => speciesById(speciesId)?.name).filter(Boolean).join(", ")} are identified in the designated stocked-water layer.</p>
                <a href={location.stocking.sourceUrl} target="_blank" rel="noreferrer">Open the DWR trout map <ExternalLink size={14} /></a>
                <a href={location.stocking.planUrl} target="_blank" rel="noreferrer">Read the 2026 stocking plan <ExternalLink size={14} /></a>
                <small>Designation does not confirm the latest stocking date or that stocked fish remain. Posted signs control boundaries.</small>
              </section>
            )}
          </aside>
        </section>
      </main>
    </div>
  );
}
