/**
 * Local (no-backend) builders for the fish guide. The species profiles are bundled
 * into the frontend (species-profiles.json) and evidence lives in data.ts, so the
 * guide renders fully without the API being reachable.
 */
import type { FishFacts, SpeciesLocation } from "./api";
import { locations, speciesById } from "./data";
import { opportunityFor } from "./scoring";
import { guideProfileFor, type SpeciesProfile } from "./species-profiles";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DIEL_TEXT: Record<string, string> = {
  crepuscular: "Most active in low light at dawn and dusk; slower under bright midday sun.",
  nocturnal: "Feeds most actively after dark; slowest during bright midday.",
  diurnal: "Active through the day, strongest in morning and evening.",
  flexible: "Feeds across the day with a mild dawn and dusk edge.",
};

function monthRanges(months: number[]): string {
  const clean = [...new Set(months.filter((m) => m >= 1 && m <= 12))].sort((a, b) => a - b);
  if (!clean.length) return "";
  const groups: number[][] = [];
  for (const m of clean) {
    if (groups.length && m === groups[groups.length - 1][groups[groups.length - 1].length - 1] + 1) {
      groups[groups.length - 1].push(m);
    } else groups.push([m]);
  }
  return groups.map((g) => (g.length === 1 ? MONTHS[g[0] - 1] : `${MONTHS[g[0] - 1]}–${MONTHS[g[g.length - 1] - 1]}`)).join(", ");
}

export function localFishFacts(speciesId: string): FishFacts | null {
  const p = guideProfileFor(speciesId) as (SpeciesProfile & Record<string, unknown>) | undefined;
  if (!p) return null;
  const species = speciesById(speciesId);
  const seasonal = (p.seasonalActivityByMonth as number[]) ?? [];
  let peakMonths: number[] = [];
  if (seasonal.length === 12) {
    const threshold = Math.max(...seasonal) * 0.85;
    peakMonths = seasonal.map((v, i) => (v >= threshold ? i + 1 : 0)).filter(Boolean);
  }
  const diel = (p.dielPattern as string) ?? "flexible";
  const num = (v: unknown) => (typeof v === "number" ? v : null);
  return {
    preferredTempF: [num(p.preferredMinF), num(p.preferredMaxF)],
    toleranceTempF: [num(p.toleranceMinF), num(p.toleranceMaxF)],
    typicalSizeInches: [num(p.typicalMinInches), num(p.typicalMaxInches)],
    citationLengthInches: num(p.citationLengthInches),
    citationWeightLb: num((p as Record<string, unknown>).citationWeightLb),
    identification: (p.identification as string) ?? null,
    baits: (p.baits as string[]) ?? [],
    dielPattern: diel,
    biteTimes: DIEL_TEXT[diel] ?? DIEL_TEXT.flexible,
    spawnMonths: (p.spawnMonths as number[]) ?? [],
    spawnWindow: monthRanges((p.spawnMonths as number[]) ?? []),
    spawnTempF: num(p.spawnTempF),
    seasonalPeak: monthRanges(peakMonths),
    seasonalActivityByMonth: seasonal,
    habitat: species?.habitat ?? null,
    techniquesBySeason: (p.primaryTechniquesBySeason as FishFacts["techniquesBySeason"]) ?? {},
    waterbodyPreference: (p.waterbodyPreference as Record<string, number>) ?? {},
    family: (p.family as string) ?? null,
    nativeStatus: (p.nativeStatus as FishFacts["nativeStatus"]) ?? null,
    statusNote: (p.statusNote as string) ?? null,
    handlingNote: (p.handlingNote as string) ?? null,
    diet: (p.diet as string) ?? null,
    confusedWith: (p.confusedWith as FishFacts["confusedWith"]) ?? [],
    stateRecordLb: num(p.stateRecordLb),
    confidence: (p.confidence as string) ?? null,
    sources: (p.sourceUrls as string[]) ?? [],
    notes: (p.notes as string) ?? null,
  };
}

function isInferred(evidence: { evidenceType: string; evidenceSummary?: string; sourceName?: string }): boolean {
  return (
    evidence.evidenceType === "modeled" ||
    (evidence.evidenceSummary ?? "").toLowerCase().startsWith("inferred") ||
    (evidence.sourceName ?? "").toLowerCase().includes("aquatic gap")
  );
}

export function localSpeciesWaters(speciesId: string): SpeciesLocation[] {
  const rows: SpeciesLocation[] = [];
  const targetable = speciesById(speciesId)?.targetable ?? false;
  for (const loc of locations) {
    const evidence = loc.evidence.find((e) => e.speciesId === speciesId);
    if (!evidence) continue;
    const opp = opportunityFor(loc, speciesId);
    if (!opp) continue;
    const score = targetable ? opp.score : Math.round(opp.availability * 100);
    rows.push({
      id: loc.id,
      name: loc.name,
      waterbody: loc.waterbody,
      waterbodyType: loc.waterbodyType,
      county: loc.county,
      watershed: null,
      travelMinutes: loc.travelMinutes,
      accessStatus: loc.accessStatus ?? "verified",
      availability: opp.availability,
      opportunityScore: score,
      confidenceScore: opp.confidence,
      confidenceLabel: opp.confidenceLabel,
      state: score >= 70 ? "strong" : score >= 55 ? "fair" : "low",
      evidenceType: evidence.evidenceType,
      modeled: isInferred(evidence),
      evidenceSummary: evidence.evidenceSummary ?? null,
    });
  }
  // Documented waters first, then by opportunity.
  rows.sort((a, b) => (a.modeled === b.modeled ? b.opportunityScore - a.opportunityScore : a.modeled ? 1 : -1));
  return rows;
}
