import aquaticGapPayload from "./generated/aquatic-gap-nova.json";
import troutPayload from "./generated/dwr-trout-nova.json";
import type { FishingLocationSeed, SpeciesEvidence, WaterbodyType } from "./data";

type AquaticGapSample = {
  comid: number;
  huc8: string;
  latitude: number;
  longitude: number;
  source: string;
  sampleDate: string;
  presentSpeciesIds: string[];
  absentSpeciesIds: string[];
};
type TroutWater = {
  id: string;
  objectId: number;
  name: string;
  county: string;
  latitude: number;
  longitude: number;
  stockingCategory: string;
  designation: string;
  speciesIds: string[];
  notes: string | null;
  heritageDay: boolean;
  nationalForest: boolean;
  noFallStock: boolean;
  sourceUrl: string;
};

const aquaticGapSamples = aquaticGapPayload.samples as AquaticGapSample[];
const troutWaters = troutPayload.waters as TroutWater[];

const radians = (value: number) => value * Math.PI / 180;

function milesBetween(lat1: number, lon1: number, lat2: number, lon2: number) {
  const dLat = radians(lat2 - lat1);
  const dLon = radians(lon2 - lon1);
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLon / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(value));
}

const defaultOrigin = { lat: 38.8462, lng: -77.3064 };

function defaultTravel(latitude: number, longitude: number) {
  const miles = milesBetween(defaultOrigin.lat, defaultOrigin.lng, latitude, longitude);
  return {
    distanceMiles: Math.round(miles),
    travelMinutes: Math.max(10, Math.round(10 + miles * 1.35)),
  };
}

function stockingEvidence(water: TroutWater, speciesId: string): SpeciesEvidence {
  const category = water.stockingCategory;
  return {
    speciesId,
    availability: 0.84,
    quality: null,
    evidenceConfidence: 0.9,
    evidenceType: "stocking",
    evidenceSummary: `Virginia DWR designates this reach for ${speciesId.replace("-", " ")} stocking under category ${category}. This is a designated-water record, not confirmation that fish remain today.`,
    lastEvidence: `DWR designated stocked-water layer reviewed ${troutPayload.release.reviewed}`,
    technique: "Start with a small inline spinner, spoon, or natural drift where regulations allow",
    depth: "Current seams, pool heads, and the first deeper water below riffles",
    positive: [
      `Official DWR stocked-water designation · category ${category}`,
      "Stocked species is identified directly in the DWR feature layer",
    ],
    negative: [
      "A stocked-water designation does not confirm the most recent stocking date or remaining fish",
      "DWR says mapped lines are a guide and posted signs control the legal boundary",
    ],
    sourceName: "Virginia Department of Wildlife Resources",
    sourceUrl: water.sourceUrl,
  };
}

export const troutLocations: FishingLocationSeed[] = troutWaters.map((water) => {
  const travel = defaultTravel(water.latitude, water.longitude);
  return {
    id: water.id,
    name: `${water.name} stocked reach`,
    waterbody: water.name,
    waterbodyType: "stream",
    county: water.county,
    lat: water.latitude,
    lng: water.longitude,
    ...travel,
    publicAccess: true,
    access: ["shore"],
    aliases: [water.name, `${water.name} trout`, "stocked trout"],
    notice: `Virginia DWR maps this designated stocked-water reach for public fishing. ${water.notes ?? ""} The line is a guide, not an official property boundary; verify posted signs, seasonal private-land access, parking, license requirements, and current regulations before entering.`,
    flowStatus: "No verified live gage association",
    activityEstimate: 0.55,
    accessFit: 0.78,
    bestWindow: "Check recent DWR stocking and current conditions",
    evidence: water.speciesIds.map((speciesId) => stockingEvidence(water, speciesId)),
    accessAuthority: "Virginia Department of Wildlife Resources",
    accessSourceUrl: water.sourceUrl,
    sourceReviewed: troutPayload.release.reviewed,
    stocking: {
      category: water.stockingCategory,
      designation: water.designation,
      speciesIds: water.speciesIds,
      sourceUrl: water.sourceUrl,
      planUrl: troutPayload.release.planUrl,
    },
  };
});

export function aquaticGapEvidenceForLocation(location: Pick<FishingLocationSeed, "lat" | "lng" | "waterbodyType">): SpeciesEvidence[] {
  if (!(["river", "stream"] as WaterbodyType[]).includes(location.waterbodyType)) return [];
  const nearby = aquaticGapSamples
    .map((sample) => ({ sample, distance: milesBetween(location.lat, location.lng, sample.latitude, sample.longitude) }))
    .filter((item) => item.distance <= 1.75)
    .sort((a, b) => a.distance - b.distance);
  if (nearby.length === 0) return [];

  const speciesIds = new Set(nearby.flatMap(({ sample }) => sample.presentSpeciesIds));
  return [...speciesIds].map((speciesId) => {
    const present = nearby.filter(({ sample }) => sample.presentSpeciesIds.includes(speciesId));
    const absent = nearby.filter(({ sample }) => sample.absentSpeciesIds.includes(speciesId));
    const ratio = present.length / Math.max(1, present.length + absent.length);
    const closest = present[0]?.distance ?? nearby[0].distance;
    const latest = present.map(({ sample }) => sample.sampleDate).sort().at(-1) ?? "2019-01-01";
    const sources = [...new Set(present.map(({ sample }) => sample.source))].join(", ");
    return {
      speciesId,
      availability: Math.min(0.56, 0.4 + ratio * 0.1 + Math.min(3, present.length) * 0.02),
      quality: null,
      evidenceConfidence: Math.min(0.62, 0.44 + Math.min(3, present.length) * 0.04),
      evidenceType: "modeled",
      modeled: true,
      evidenceSummary: `USGS Aquatic GAP v2.0 contains ${present.length} presence record${present.length === 1 ? "" : "s"} on sampled NHDPlus reaches within 1.75 miles. BiteMap treats this as nearby historic stream evidence, not proof at the access point.`,
      lastEvidence: `Latest nearby sample ${latest} · USGS release v2.0 (December 2024)`,
      technique: "Match the species to visible current, cover, and depth; begin with a compact natural presentation",
      depth: "Probe accessible current breaks and cover before expanding to adjacent habitat",
      positive: [`${present.length} nearby presence record${present.length === 1 ? "" : "s"} · closest ${closest.toFixed(1)} mi`, `Published sources: ${sources}`],
      negative: [
        "The record is historic and associated by nearby reach midpoint, not this exact access point",
        ...(absent.length ? [`${absent.length} nearby sample${absent.length === 1 ? "" : "s"} did not record the species`] : []),
        "Sampling methods and dates vary; this evidence cannot describe current abundance",
      ],
      sourceName: "USGS Aquatic GAP presence/absence database",
      sourceUrl: "https://doi.org/10.5066/P9FZ6J6R",
    };
  });
}

export const publicDataStats = {
  aquaticGapSamples: aquaticGapPayload.scope.sampleCount,
  aquaticGapSpecies: aquaticGapPayload.scope.speciesCount,
  troutWaters: troutPayload.scope.waterCount,
};
