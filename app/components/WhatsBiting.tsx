import { AlertTriangle, ChevronDown, Clock3, ExternalLink, Fish, Gauge, Info } from "./ClientIcons";
import { fetchWhatsBiting, type ScoredSpecies } from "../lib/api";
import { FishFactsPanel } from "./FishFactsPanel";

export type KnownSpecies = {
  speciesId: string;
  name: string;
  evidenceType: string;
  availability: number;
  evidenceSummary: string;
  lastEvidence: string;
  modeled: boolean;
  sourceName?: string;
  sourceUrl?: string;
};

type Props = {
  locationId: string;
  known: KnownSpecies[];
};

const STATE_LABEL: Record<ScoredSpecies["state"], string> = {
  strong: "Strong today",
  fair: "Fair today",
  low: "Low today",
};

const EVIDENCE_LABEL: Record<string, string> = {
  "official listing": "Official listing",
  "agency survey": "Agency survey",
  stocking: "Stocked-water designation",
  modeled: "Nearby / modeled",
};

function evidenceBadge(type: string, modeled: boolean, summary?: string | null) {
  if (summary && summary.toLowerCase().startsWith("inferred")) return "Inferred (basin)";
  if (modeled) return "Nearby / modeled";
  return EVIDENCE_LABEL[type] ?? type;
}

export async function WhatsBiting({ locationId, known }: Props) {
  if (known.length === 0) {
    return (
      <article className="biting-card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Fish at this water</span>
            <h2>No confirmed species yet</h2>
          </div>
        </div>
        <p className="biting-empty">
          Public access here is agency-verified, but no species evidence has cleared the BiteMap evidence gate.
          Absence of evidence is not evidence a fish is absent — it means BiteMap has nothing reliable to show.
        </p>
      </article>
    );
  }

  const scored = await fetchWhatsBiting(locationId, false);

  return (
    <article className="biting-card">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Fish at this water · what&apos;s biting</span>
          <h2>{known.length} species with evidence here</h2>
        </div>
        {scored ? (
          <span className="biting-mode">
            {scored.liveConditions ? "Live conditions" : "Seasonal estimate"}
          </span>
        ) : (
          <span className="biting-mode biting-mode-offline">Evidence only</span>
        )}
      </div>

      {scored ? (
        <>
          <ul className="biting-list">
            {scored.species.map((species) => (
              <li key={species.speciesId} className={`biting-row biting-${species.state}`}>
                <div className="biting-row-head">
                  <div className="biting-name">
                    <Fish size={16} />
                    <strong>{species.name}</strong>
                    <span className={`biting-badge biting-badge-${species.state}`}>{STATE_LABEL[species.state]}</span>
                  </div>
                  <div className="biting-score">
                    <strong>{species.opportunity_score}</strong>
                    <span>/100</span>
                  </div>
                </div>
                <div className="biting-meta">
                  <span><Gauge size={13} /> {species.confidence_label} confidence · {species.confidence_score}%</span>
                  {species.bestWindow && <span><Clock3 size={13} /> Best window {species.bestWindow}</span>}
                  <span className="biting-evidence">{evidenceBadge(species.evidence_type, species.modeled, species.evidence_summary)}</span>
                </div>
                {species.evidence_summary && <p className="biting-summary">{species.evidence_summary}</p>}
                {species.factors?.negative?.length > 0 && (
                  <p className="biting-caveat"><AlertTriangle size={12} /> {species.factors.negative[0]}</p>
                )}
                {species.fishFacts && (
                  <details className="fish-drawer">
                    <summary>
                      <span><Fish size={13} /> Learn about {species.name.toLowerCase()}</span>
                      <ChevronDown size={14} className="fish-drawer-chevron" />
                    </summary>
                    <FishFactsPanel
                      facts={species.fishFacts}
                      stocked={species.stocked}
                      stockingCategory={species.stockingCategory}
                      stockingPlanUrl={species.stockingPlanUrl}
                    />
                    <a className="fish-guide-link" href={`/fish/${species.speciesId}`}>
                      Full {species.name.toLowerCase()} guide <ExternalLink size={12} />
                    </a>
                  </details>
                )}
              </li>
            ))}
          </ul>
          {scored.insufficient.length > 0 && (
            <div className="biting-insufficient">
              <h3>Reported but not confirmed here</h3>
              <p>
                {scored.insufficient.map((item) => item.name).join(", ")} — evidence has not cleared the availability
                gate, so BiteMap does not rank them at this spot.
              </p>
            </div>
          )}
          <p className="biting-disclaimer">
            <Info size={12} /> {scored.disclaimer}
          </p>
        </>
      ) : (
        <>
          <p className="biting-offline-note">
            <Info size={13} /> Live opportunity scoring is unavailable right now; showing the agency evidence on record.
          </p>
          <ul className="biting-list">
            {[...known].sort((a, b) => b.availability - a.availability).map((species) => (
              <li key={species.speciesId} className="biting-row biting-evidence-only">
                <div className="biting-row-head">
                  <div className="biting-name">
                    <Fish size={16} />
                    <strong>{species.name}</strong>
                    <span className="biting-badge biting-badge-neutral">{evidenceBadge(species.evidenceType, species.modeled, species.evidenceSummary)}</span>
                  </div>
                  <div className="biting-score biting-score-muted">
                    <strong>{Math.round(species.availability * 100)}</strong>
                    <span>/100 presence</span>
                  </div>
                </div>
                <p className="biting-summary">{species.evidenceSummary}</p>
                <p className="biting-caveat">{species.lastEvidence}</p>
              </li>
            ))}
          </ul>
        </>
      )}
    </article>
  );
}
