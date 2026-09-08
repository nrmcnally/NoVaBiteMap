import Link from "next/link";
import type { ReactNode } from "react";
import { AlertTriangle, ChevronDown, Clock3, ExternalLink, Fish, Gauge, Info } from "./ClientIcons";
import { fetchWhatsBiting, type ScoredSpecies } from "../lib/api";
import { fishImageFor } from "../lib/fish-images";
import { FishFactsPanel } from "./FishFactsPanel";

export type KnownSpecies = {
  speciesId: string;
  name: string;
  scientificName?: string;
  targetable: boolean;
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
  strong: "Strong opportunity",
  fair: "Fair opportunity",
  low: "Low opportunity",
};

const EVIDENCE_LABEL: Record<string, string> = {
  "official listing": "Official listing",
  "agency survey": "Agency survey",
  stocking: "Stocked-water designation",
  modeled: "Reported nearby",
};

function evidenceBadge(type: string, modeled: boolean, summary?: string | null) {
  if (summary && summary.toLowerCase().startsWith("inferred")) return "Reported in the watershed";
  if (modeled) return "Reported nearby";
  return EVIDENCE_LABEL[type] ?? type;
}

type FishIdentityProps = {
  speciesId: string;
  name: string;
  scientificName?: string | null;
  badge?: ReactNode;
};

function FishIdentity({ speciesId, name, scientificName, badge }: FishIdentityProps) {
  const image = fishImageFor(speciesId);
  return (
    <div className="biting-identity">
      <span
        className={`biting-fish-thumb${image ? " has-photo" : ""}`}
        style={image ? { backgroundImage: `url(${image.src})` } : undefined}
        aria-hidden="true"
      >
        {!image && <Fish size={18} />}
      </span>
      <div className="biting-identity-copy">
        <div className="biting-name-line">
          <Link href={`/fish/${speciesId}`}>{name}</Link>
          {badge}
        </div>
        {scientificName && <small><em>{scientificName}</em></small>}
      </div>
    </div>
  );
}

function SpeciesLinks({ speciesId, sourceName, sourceUrl }: { speciesId: string; sourceName?: string | null; sourceUrl?: string | null }) {
  return (
    <div className="biting-row-links">
      <Link href={`/fish/${speciesId}`}>Open fish guide</Link>
      {sourceUrl && (
        <a href={sourceUrl} target="_blank" rel="noreferrer">
          {sourceName ?? "Fish record source"} <ExternalLink size={11} />
        </a>
      )}
    </div>
  );
}

type EvidenceOnlyFish = {
  speciesId: string;
  name: string;
  scientificName?: string | null;
  availability: number;
  evidenceType: string;
  evidenceSummary?: string | null;
  lastEvidence?: string | null;
  modeled: boolean;
  sourceName?: string | null;
  sourceUrl?: string | null;
};

function EvidenceOnlySection({ title, description, fish }: { title: string; description: string; fish: EvidenceOnlyFish[] }) {
  if (fish.length === 0) return null;
  return (
    <section className="biting-evidence-section">
      <div className="biting-subheading">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      <ul className="biting-list biting-list-compact">
        {fish.map((item) => (
          <li key={item.speciesId} className="biting-row biting-evidence-only">
            <div className="biting-row-head">
              <FishIdentity
                speciesId={item.speciesId}
                name={item.name}
                scientificName={item.scientificName}
                badge={<span className="biting-badge biting-badge-neutral">No bite forecast</span>}
              />
              <div className="biting-score biting-score-muted" title="Strength of the fish record, not a bite score">
                <strong>{Math.round(item.availability * 100)}</strong>
                <span>/100 record</span>
              </div>
            </div>
            <div className="biting-meta">
              <span className="biting-evidence">{evidenceBadge(item.evidenceType, item.modeled, item.evidenceSummary)}</span>
            </div>
            {item.evidenceSummary && <p className="biting-summary">{item.evidenceSummary}</p>}
            {item.lastEvidence && <p className="biting-caveat">{item.lastEvidence}</p>}
            <SpeciesLinks speciesId={item.speciesId} sourceName={item.sourceName} sourceUrl={item.sourceUrl} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export async function WhatsBiting({ locationId, known }: Props) {
  if (known.length === 0) {
    return (
      <article className="biting-card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Fish at this water</span>
            <h2>No fish records yet</h2>
          </div>
        </div>
        <p className="biting-empty">
          This is a documented public access point, but BiteMap does not yet have a reliable fish list for it.
          Fish may still be present; there simply is not enough information to show them here yet.
        </p>
      </article>
    );
  }

  const scored = await fetchWhatsBiting(locationId, false);
  const knownById = new Map(known.map((item) => [item.speciesId, item]));
  const returnedIds = new Set(scored ? [
    ...scored.species.map((item) => item.speciesId),
    ...scored.community.map((item) => item.speciesId),
    ...scored.insufficient.map((item) => item.speciesId),
  ] : []);
  const unpartitioned = scored ? known.filter((item) => !returnedIds.has(item.speciesId)) : [];
  const presenceOnly: EvidenceOnlyFish[] = scored ? [
    ...scored.community.map((item) => {
      const local = knownById.get(item.speciesId);
      return {
        speciesId: item.speciesId,
        name: item.name,
        scientificName: item.scientificName ?? local?.scientificName,
        availability: item.availabilityScore,
        evidenceType: item.evidenceType,
        evidenceSummary: local?.evidenceSummary,
        lastEvidence: local?.lastEvidence,
        modeled: item.modeled,
        sourceName: local?.sourceName,
        sourceUrl: local?.sourceUrl,
      };
    }),
    ...unpartitioned,
  ].sort((a, b) => a.name.localeCompare(b.name)) : [];

  return (
    <article className="biting-card">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Fish at this spot</span>
          <h2>{known.length} species on record</h2>
        </div>
        {scored ? (
          <span className="biting-mode">
            {scored.liveConditions ? "Live conditions" : "Seasonal estimate"}
          </span>
        ) : (
          <span className="biting-mode biting-mode-offline">Records only</span>
        )}
      </div>

      {scored ? (
        <>
          <p className="biting-intro">
            Bite forecasts are shown only when the fish has a reliable local record and a reviewed activity model.
            Other recorded species remain listed without a bite score.
          </p>
          <div className="biting-counts" aria-label="Fish outlook summary">
            <span><strong>{scored.species.length}</strong> bite {scored.species.length === 1 ? "forecast" : "forecasts"}</span>
            <span><strong>{presenceOnly.length}</strong> records without forecasts</span>
            {scored.insufficient.length > 0 && <span><strong>{scored.insufficient.length}</strong> unconfirmed</span>}
          </div>

          {scored.species.length > 0 && (
            <>
              <div className="biting-subheading biting-forecast-heading">
                <h3>Bite forecast</h3>
                <p>Strong, fair, and low describe relative opportunity—not whether a fish is present or a guaranteed catch.</p>
              </div>
              <ul className="biting-list">
                {scored.species.map((species) => (
                  <li key={species.speciesId} className={`biting-row biting-${species.state}`}>
                    <div className="biting-row-head">
                      <FishIdentity
                        speciesId={species.speciesId}
                        name={species.name}
                        scientificName={species.scientificName}
                        badge={<span className={`biting-badge biting-badge-${species.state}`}>{STATE_LABEL[species.state]}</span>}
                      />
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
                    {species.seasonal && (
                      <p className={`biting-seasonal${species.inSeason ? " in-season" : " off-season"}`}>
                        <Clock3 size={12} /> Seasonal run · {species.seasonal.label}
                        <strong>{species.inSeason ? "In season now" : "Out of season now"}</strong>
                      </p>
                    )}
                    {species.evidence_summary && <p className="biting-summary">{species.evidence_summary}</p>}
                    {species.factors?.negative?.length > 0 && (
                      <p className="biting-caveat"><AlertTriangle size={12} /> {species.factors.negative[0]}</p>
                    )}
                    <SpeciesLinks speciesId={species.speciesId} sourceName={species.source_name} sourceUrl={species.source_url} />
                    {species.fishFacts && (
                      <details className="fish-drawer">
                        <summary>
                          <span><Fish size={13} /> Quick guide to {species.name.toLowerCase()}</span>
                          <ChevronDown size={14} className="fish-drawer-chevron" />
                        </summary>
                        <FishFactsPanel
                          facts={species.fishFacts}
                          stocked={species.stocked}
                          stockingCategory={species.stockingCategory}
                          stockingPlanUrl={species.stockingPlanUrl}
                        />
                      </details>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}

          <EvidenceOnlySection
            title="Recorded here · no bite forecast"
            description="Agency records identify these fish in this water or mapped river section, but BiteMap does not yet have a reviewed activity model for them."
            fish={presenceOnly.filter((item) => !item.modeled)}
          />
          <EvidenceOnlySection
            title="Reported nearby · not confirmed at this spot"
            description="These fish are documented nearby or elsewhere in the watershed, not at this exact access point."
            fish={presenceOnly.filter((item) => item.modeled)}
          />

          {scored.insufficient.length > 0 && (
            <div className="biting-insufficient">
              <h3>Reported, but not confirmed at this spot</h3>
              <p>The available records are not specific or strong enough to confirm these fish at this spot, so they do not receive a bite forecast.</p>
              <div className="biting-insufficient-links">
                {scored.insufficient.map((item) => <Link key={item.speciesId} href={`/fish/${item.speciesId}`}>{item.name}</Link>)}
              </div>
            </div>
          )}
          <p className="biting-disclaimer">
            <Info size={12} /> {scored.disclaimer}
          </p>
        </>
      ) : (
        <>
          <p className="biting-offline-note">
            <Info size={13} /> The bite forecast is unavailable right now. The fish records below are still available, but they do not say whether a species is currently biting.
          </p>
          <EvidenceOnlySection
            title="Recorded fish · forecast unavailable"
            description="Agency records identify these fish in this water or mapped river section. Open a species for its full field guide."
            fish={known.filter((species) => !species.modeled)}
          />
          <EvidenceOnlySection
            title="Reported nearby · not confirmed at this spot"
            description="These fish are documented nearby or elsewhere in the watershed, not at this exact access point."
            fish={known.filter((species) => species.modeled)}
          />
        </>
      )}
    </article>
  );
}
