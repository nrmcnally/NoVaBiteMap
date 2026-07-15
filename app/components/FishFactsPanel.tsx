import { Clock3, ExternalLink, Info, Ruler, Sparkles, Thermometer, Waves } from "./ClientIcons";
import type { FishFacts } from "../lib/api";

function tempRange(range: [number | null, number | null]) {
  if (range[0] == null || range[1] == null) return null;
  return `${range[0]}–${range[1]}°F`;
}

function sizeRange(range: [number | null, number | null]) {
  if (range[0] == null || range[1] == null) return null;
  return `${range[0]}–${range[1]} in`;
}

function citation(facts: FishFacts) {
  const parts: string[] = [];
  if (facts.citationLengthInches) parts.push(`${facts.citationLengthInches} in`);
  if (facts.citationWeightLb) parts.push(`${facts.citationWeightLb} lb`);
  return parts.length ? parts.join(" or ") : null;
}

type Props = {
  facts: FishFacts;
  stocked?: boolean;
  stockingCategory?: string | null;
  stockingPlanUrl?: string | null;
  variant?: "drawer" | "page";
};

export function FishFactsPanel({ facts, stocked, stockingCategory, stockingPlanUrl, variant = "drawer" }: Props) {
  const preferred = tempRange(facts.preferredTempF);
  const tolerance = tempRange(facts.toleranceTempF);
  const size = sizeRange(facts.typicalSizeInches);
  const cite = citation(facts);

  return (
    <div className={`fish-facts fish-facts-${variant}`}>
      <div className="fish-fact-grid">
        {preferred && (
          <div className="fish-fact">
            <Thermometer size={14} />
            <span>Preferred water</span>
            <strong>{preferred}</strong>
            {tolerance && <small>Tolerates {tolerance}</small>}
          </div>
        )}
        {size && (
          <div className="fish-fact">
            <Ruler size={14} />
            <span>Typical size</span>
            <strong>{size}</strong>
            {cite && <small>VA citation {cite}</small>}
          </div>
        )}
        <div className="fish-fact">
          <Clock3 size={14} />
          <span>When they bite</span>
          <strong className="fish-fact-diel">{facts.dielPattern}</strong>
          {facts.seasonalPeak && <small>Peak {facts.seasonalPeak}</small>}
        </div>
        {facts.spawnWindow && (
          <div className="fish-fact">
            <Sparkles size={14} />
            <span>Spawn</span>
            <strong>{facts.spawnWindow}</strong>
            {facts.spawnTempF && <small>~{facts.spawnTempF}°F trigger</small>}
          </div>
        )}
      </div>

      <p className="fish-bite-times">{facts.biteTimes}</p>

      {facts.baits.length > 0 && (
        <div className="fish-baits">
          <h4>Productive baits &amp; lures</h4>
          <div className="fish-bait-chips">
            {facts.baits.map((bait) => (
              <span key={bait}>{bait}</span>
            ))}
          </div>
        </div>
      )}

      {facts.habitat && (
        <p className="fish-habitat"><Waves size={13} /> {facts.habitat}</p>
      )}

      {stocked && (
        <div className="fish-stocking">
          <strong>Stocked water{stockingCategory ? ` · DWR category ${stockingCategory}` : ""}</strong>
          <p>
            This is a DWR designated stocked-water record. It confirms the species is stocked here, but the latest
            stocking date is not in BiteMap&apos;s dataset — check the current DWR schedule before you go.
          </p>
          {stockingPlanUrl && (
            <a href={stockingPlanUrl} target="_blank" rel="noreferrer">DWR stocking plan <ExternalLink size={12} /></a>
          )}
        </div>
      )}

      {variant === "page" && facts.notes && (
        <p className="fish-notes"><Info size={13} /> {facts.notes}</p>
      )}

      {facts.sources.length > 0 && (
        <div className="fish-sources">
          <span>Sources:</span>
          {facts.sources.slice(0, 4).map((url, index) => (
            <a key={url} href={url} target="_blank" rel="noreferrer">
              {sourceLabel(url)}{index < Math.min(facts.sources.length, 4) - 1 ? "," : ""}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function sourceLabel(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (host.includes("dwr.virginia.gov")) return "Virginia DWR";
    if (host.includes("eregulations")) return "VA regulations";
    if (host.includes("usgs.gov")) return "USGS";
    return host;
  } catch {
    return "source";
  }
}
