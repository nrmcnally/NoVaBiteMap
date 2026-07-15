import { coverageLocations } from "./coverage-data";
import { advisoryForLocation, vdhAdvisoryIndexUrl, type ConsumptionAdvisory } from "./advisories";
import { hydrologyForLocation, type HydrologyAssociation } from "./hydrology";
import { aquaticGapEvidenceForLocation, troutLocations } from "./public-evidence";
import { dwrAccessLocations, likelyPresentFor, nhdParkWaterLocations, nhdStreamLocations, promotedEvidenceFor, waterbodySpeciesFor } from "./expanded-coverage";
import evidenceRejections from "./generated/evidence-rejections.json";

export type AccessMethod = "shore" | "wade" | "kayak" | "boat";
export type WaterbodyType = "river" | "reservoir" | "lake" | "pond" | "bay" | "stream";
// How well public access is established:
//  verified  = agency-confirmed public access point (DWR/park/NPS).
//  listed    = named public water an agency lists, access point not pinpointed.
//  unverified = named water surfaced for discovery; confirm public access before fishing.
export type AccessStatus = "verified" | "listed" | "unverified";
export type { AdvisoryStatus, ConsumptionAdvisory } from "./advisories";

export type Species = {
  id: string;
  name: string;
  scientificName: string;
  short: string;
  habitat: string;
  family?: string;
  targetable: boolean;
};

export type SpeciesEvidence = {
  speciesId: string;
  availability: number;
  quality: number | null;
  evidenceConfidence: number;
  evidenceType: "official listing" | "agency survey" | "stocking" | "modeled";
  evidenceSummary: string;
  lastEvidence: string;
  technique: string;
  depth: string;
  positive: string[];
  negative: string[];
  sourceName?: string;
  sourceUrl?: string;
  modeled?: boolean;
};

export type CanonicalOpportunity = {
  score: number;
  confidence: number;
  confidenceLabel: "High" | "Moderate" | "Low";
  availability: number;
  quality: number | null;
  activity: number;
  accessFit: number;
  evidence: SpeciesEvidence;
};

export type FishingLocation = {
  id: string;
  name: string;
  waterbody: string;
  waterbodyType: WaterbodyType;
  county: string;
  lat: number;
  lng: number;
  distanceMiles: number;
  travelMinutes: number;
  publicAccess: boolean;
  access: AccessMethod[];
  aliases: string[];
  notice: string;
  flowStatus: string;
  activityEstimate: number;
  accessFit: number;
  bestWindow: string;
  evidence: SpeciesEvidence[];
  accessAuthority: string;
  accessSourceUrl: string;
  sourceReviewed: string;
  accessStatus?: AccessStatus;
  hydrology?: HydrologyAssociation;
  stocking?: {
    category: string;
    designation: string;
    speciesIds: string[];
    sourceUrl: string;
    planUrl: string;
  };
  consumptionAdvisory: ConsumptionAdvisory;
  /** Present when this row came from the canonical FastAPI/PostgreSQL runtime. */
  runtimeSource?: "canonical-api";
  /** Database-scored opportunities keyed by species id. */
  opportunities?: Record<string, CanonicalOpportunity>;
};

export type FishingLocationSeed = Omit<FishingLocation, "consumptionAdvisory">;

export const sourceLinks = {
  access:
    "https://services.dwr.virginia.gov/arcgis/rest/services/Public/BoatingAccessSites/FeatureServer/0",
  shenandoah:
    "https://dwr.virginia.gov/blog/five-great-places-in-the-northern-shenandoah-valley-to-fish-after-work/",
  shenandoahMainStem:
    "https://dwr.virginia.gov/waterbody/shenandoah-river-main-stem/",
  shenandoahNorthFork:
    "https://dwr.virginia.gov/waterbody/shenandoah-river-north-fork/",
  shenandoahSouthFork:
    "https://dwr.virginia.gov/waterbody/shenandoah-river-south-fork/",
  walleye2026:
    "https://dwr.virginia.gov/wp-content/uploads/media/Walleye-Fishing-Forecast-2026.pdf",
  aquaticGap:
    "https://www.usgs.gov/data/aquatic-gap-analysis-project-aquatic-gap-aquatic-species-distribution-modeling-national",
  aquaticGapPresence: "https://doi.org/10.5066/P9FZ6J6R",
  nws: "https://www.weather.gov/documentation/services-web-api",
  fairfaxFishing: "https://www.fairfaxcounty.gov/parks/fishing",
  fairfaxSmallLakes: "https://www.fairfaxcounty.gov/parks/small-lakes",
  npsGwmpFishing: "https://www.nps.gov/gwmp/planyourvisit/fishing.htm",
  npsGreatFalls: "https://www.nps.gov/grfa/planyourvisit/outdooractivities.htm",
  novaFountainhead: "https://www.novaparks.com/parks/fountainhead-regional-park/things-to-do/fishing",
  novaBullRun: "https://www.novaparks.com/parks/bull-run-marina/things-to-do/fishing",
  novaPohick: "https://www.novaparks.com/parks/pohick-bay-regional-park/things-to-do/fishing",
  novaAlgonkian: "https://www.novaparks.com/parks/algonkian-regional-park/things-to-do/fishing",
  novaPiscataway: "https://www.novaparks.com/parks/piscataway-crossing-regional-park/things-to-do/fishing",
  novaSeneca: "https://www.novaparks.com/parks/seneca-regional-park/things-to-do/fishing",
  novaOccoquan: "https://www.novaparks.com/parks/occoquan-regional-park/things-to-do/fishing",
  novaReservoir: "https://www.novaparks.com/parks/reservoir-park/things-to-do/fishing",
  dcrFishing: "https://www.dcr.virginia.gov/state-parks/fishing",
  dcrLeesylvania: "https://www.dcr.virginia.gov/state-parks/leesylvania",
  dcrMasonNeck: "https://www.dcr.virginia.gov/state-parks/mason-neck",
  pwcFishing: "https://www.pwcva.gov/department/parks-recreation/fishing/",
  vdhFishAdvisories: vdhAdvisoryIndexUrl,
};

export const species: Species[] = [
  { id: "smallmouth-bass", name: "Smallmouth bass", scientificName: "Micropterus dolomieu", short: "SMB", habitat: "Rocky rivers, current seams, ledges", targetable: true },
  { id: "largemouth-bass", name: "Largemouth bass", scientificName: "Micropterus salmoides", short: "LMB", habitat: "Vegetated lakes, reservoirs, woody cover", targetable: true },
  { id: "spotted-bass", name: "Spotted bass", scientificName: "Micropterus punctulatus", short: "SPB", habitat: "Reservoirs and flowing water where supported", targetable: true },
  { id: "bluegill", name: "Bluegill", scientificName: "Lepomis macrochirus", short: "BG", habitat: "Shallow cover, docks, vegetation", targetable: true },
  { id: "redbreast-sunfish", name: "Redbreast sunfish", scientificName: "Lepomis auritus", short: "RBS", habitat: "Warm, rocky rivers and creeks", targetable: true },
  { id: "black-crappie", name: "Black crappie", scientificName: "Pomoxis nigromaculatus", short: "BCP", habitat: "Brush, docks, suspended schools", targetable: true },
  { id: "white-crappie", name: "White crappie", scientificName: "Pomoxis annularis", short: "WCP", habitat: "Turbid reservoirs and woody cover", targetable: true },
  { id: "channel-catfish", name: "Channel catfish", scientificName: "Ictalurus punctatus", short: "CCF", habitat: "Pools, channels, reservoirs", targetable: true },
  { id: "blue-catfish", name: "Blue catfish", scientificName: "Ictalurus furcatus", short: "BCF", habitat: "Large tidal rivers and channels", targetable: true },
  { id: "flathead-catfish", name: "Flathead catfish", scientificName: "Pylodictis olivaris", short: "FCF", habitat: "Deep river holes and wood", targetable: true },
  { id: "rainbow-trout", name: "Rainbow trout", scientificName: "Oncorhynchus mykiss", short: "RBT", habitat: "Cool stocked and coldwater streams", targetable: true },
  { id: "brown-trout", name: "Brown trout", scientificName: "Salmo trutta", short: "BNT", habitat: "Cool streams with cover", targetable: true },
  { id: "brook-trout", name: "Brook trout", scientificName: "Salvelinus fontinalis", short: "BKT", habitat: "Cold headwater streams", targetable: true },
  { id: "common-carp", name: "Common carp", scientificName: "Cyprinus carpio", short: "CARP", habitat: "Slow rivers, reservoirs, flats", targetable: true },
  { id: "northern-snakehead", name: "Northern snakehead", scientificName: "Channa argus", short: "NSH", habitat: "Tidal vegetation and backwaters", targetable: true },
  { id: "walleye", name: "Walleye", scientificName: "Sander vitreus", short: "WAE", habitat: "Rivers and reservoirs where supported", targetable: true },
  { id: "yellow-perch", name: "Yellow perch", scientificName: "Perca flavescens", short: "YEP", habitat: "Reservoir edges and tidal tributaries", targetable: true },
  { id: "white-perch", name: "White perch", scientificName: "Morone americana", short: "WHP", habitat: "Tidal fresh and brackish water", targetable: true },
  { id: "striped-bass", name: "Striped bass", scientificName: "Morone saxatilis", short: "STB", habitat: "Large reservoirs and tidal rivers", targetable: true },
  { id: "muskellunge", name: "Muskellunge", scientificName: "Esox masquinongy", short: "MUS", habitat: "Large rivers where agency evidence supports them", targetable: true },

  // Fish-community records observed in the regional USGS Aquatic GAP import.
  // These are searchable reference pages, but are not offered as bite-scoring
  // targets until a species-specific activity profile has been reviewed.
  { id: "american-eel", name: "American eel", scientificName: "Anguilla rostrata", short: "AEL", habitat: "Migratory rivers, connected streams, and tidal headwaters", family: "Freshwater eels", targetable: false },
  { id: "blacknose-dace", name: "Blacknose dace", scientificName: "Rhinichthys atratulus", short: "BND", habitat: "Rocky headwater streams, riffles, and runs", family: "Minnows and chubs", targetable: false },
  { id: "brown-bullhead", name: "Brown bullhead", scientificName: "Ameiurus nebulosus", short: "BBH", habitat: "Ponds, lakes, and slow vegetated water", family: "Bullhead catfishes", targetable: false },
  { id: "creek-chub", name: "Creek chub", scientificName: "Semotilus atromaculatus", short: "CKC", habitat: "Small streams, pools, and undercut banks", family: "Minnows and chubs", targetable: false },
  { id: "fallfish", name: "Fallfish", scientificName: "Semotilus corporalis", short: "FAL", habitat: "Clear rivers and larger streams with pools", family: "Minnows and chubs", targetable: false },
  { id: "green-sunfish", name: "Green sunfish", scientificName: "Lepomis cyanellus", short: "GSF", habitat: "Warm ponds, creeks, and shoreline cover", family: "Sunfishes", targetable: false },
  { id: "longnose-dace", name: "Longnose dace", scientificName: "Rhinichthys cataractae", short: "LND", habitat: "Fast rocky riffles in cool streams", family: "Minnows and chubs", targetable: false },
  { id: "mottled-sculpin", name: "Mottled sculpin", scientificName: "Cottus bairdii", short: "MSC", habitat: "Cold, clean rocky streams", family: "Sculpins", targetable: false },
  { id: "northern-hogsucker", name: "Northern hog sucker", scientificName: "Hypentelium nigricans", short: "NHS", habitat: "Clear rocky riffles and runs", family: "Suckers and redhorses", targetable: false },
  { id: "pumpkinseed", name: "Pumpkinseed", scientificName: "Lepomis gibbosus", short: "PKS", habitat: "Vegetated ponds, lakes, and slow water", family: "Sunfishes", targetable: false },
  { id: "rock-bass", name: "Rock bass", scientificName: "Ambloplites rupestris", short: "RKB", habitat: "Rocky rivers, streams, and lake shorelines", family: "Sunfishes", targetable: false },
  { id: "shorthead-redhorse", name: "Shorthead redhorse", scientificName: "Moxostoma macrolepidotum", short: "SHR", habitat: "Medium and large rivers with clean gravel", family: "Suckers and redhorses", targetable: false },
  { id: "tessellated-darter", name: "Tessellated darter", scientificName: "Etheostoma olmstedi", short: "TSD", habitat: "Streams with slow to moderate current over sand and gravel", family: "Perches and darters", targetable: false },
  { id: "white-sucker", name: "White sucker", scientificName: "Catostomus commersonii", short: "WSK", habitat: "Cool streams, rivers, and lake shallows", family: "Suckers and redhorses", targetable: false },
  { id: "yellow-bullhead", name: "Yellow bullhead", scientificName: "Ameiurus natalis", short: "YBH", habitat: "Warm ponds and slow vegetated water", family: "Bullhead catfishes", targetable: false },
  { id: "white-catfish", name: "White catfish", scientificName: "Ameiurus catus", short: "WCF", habitat: "Tidal rivers, estuaries, and slow lower rivers", family: "Bullhead catfishes", targetable: false },
  { id: "gizzard-shad", name: "Gizzard shad", scientificName: "Dorosoma cepedianum", short: "GZS", habitat: "Reservoirs and large rivers; open-water forage schools", family: "Herrings and shads", targetable: false },
];

export const targetSpecies = species.filter((item) => item.targetable);

const shenandoahSmallmouth = (
  freshness: string,
  segment: "main-stem" | "north-fork" | "south-fork",
): SpeciesEvidence => ({
  speciesId: "smallmouth-bass",
  availability: 0.91,
  quality: 0.78,
  evidenceConfidence: 0.88,
  evidenceType: "official listing",
  evidenceSummary: `Virginia DWR documents smallmouth bass throughout the ${segment === "main-stem" ? "Main Stem" : segment === "north-fork" ? "North Fork" : "South Fork"} Shenandoah River.`,
  lastEvidence: freshness,
  technique: "3–4 in. natural paddletail or craw tube along current breaks",
  depth: "Lower third of the water column; slide shallower in low light",
  positive: ["Strong official waterbody evidence", "Rocky current habitat matches the species profile"],
  negative: ["Hourly activity is a seasonal estimate until live providers refresh", "Access-point conditions can differ along the river"],
  sourceName: "Virginia Department of Wildlife Resources",
  sourceUrl: segment === "main-stem"
    ? sourceLinks.shenandoahMainStem
    : segment === "north-fork"
      ? sourceLinks.shenandoahNorthFork
      : sourceLinks.shenandoahSouthFork,
});

const shenandoahWalleye = (freshness: string): SpeciesEvidence => ({
  speciesId: "walleye",
  availability: 0.74,
  quality: 0.63,
  evidenceConfidence: 0.74,
  evidenceType: "official listing",
  evidenceSummary:
    "Virginia DWR describes walleye throughout the Main Stem Shenandoah River.",
  lastEvidence: freshness,
  technique: "Small minnow-profile jig worked slowly near deeper seams",
  depth: "Deep current edge, especially near dawn and dusk",
  positive: ["Official regional fishery evidence"],
  negative: ["Evidence is broader than this individual access point"],
  sourceName: "Virginia Department of Wildlife Resources",
  sourceUrl: sourceLinks.shenandoahMainStem,
});

const burkeEvidence: SpeciesEvidence[] = [
  {
    speciesId: "largemouth-bass",
    availability: 0.86,
    quality: 0.72,
    evidenceConfidence: 0.8,
    evidenceType: "official listing",
    evidenceSummary: "DWR material identifies Burke Lake as a priority fishery and documents bass use of the lake.",
    lastEvidence: "DWR source reviewed 2026-07-13",
    technique: "Weightless worm or compact jig around shaded cover",
    depth: "Shallow shade early; outside weed edge after sunrise",
    positive: ["Official DWR priority-fishery designation", "Public bank and boat access"],
    negative: ["No live water-temperature observation in the current snapshot"],
    sourceName: "Virginia Department of Wildlife Resources",
    sourceUrl: "https://dwr.virginia.gov/waterbody/lake-burke/",
  },
  {
    speciesId: "black-crappie",
    availability: 0.78,
    quality: 0.62,
    evidenceConfidence: 0.72,
    evidenceType: "official listing",
    evidenceSummary: "Virginia DWR material documents crappie among the lake’s fishery.",
    lastEvidence: "DWR source reviewed 2026-07-13",
    technique: "Small minnow or 1.5–2 in. jig near brush and shade",
    depth: "Mid-column around cover",
    positive: ["Official species evidence"],
    negative: ["Fishery-quality metric is a coarse agency classification"],
    sourceName: "Virginia Department of Wildlife Resources",
    sourceUrl: "https://dwr.virginia.gov/waterbody/lake-burke/",
  },
  {
    speciesId: "yellow-perch",
    availability: 0.7,
    quality: null,
    evidenceConfidence: 0.66,
    evidenceType: "official listing",
    evidenceSummary: "Virginia DWR material documents yellow perch at Burke Lake.",
    lastEvidence: "DWR source reviewed 2026-07-13",
    technique: "Small jig or live minnow along the first break",
    depth: "Bottom third near a depth change",
    positive: ["Official species evidence"],
    negative: ["Comparable long-term quality data unavailable"],
    sourceName: "Virginia Department of Wildlife Resources",
    sourceUrl: "https://dwr.virginia.gov/waterbody/lake-burke/",
  },
];

const lakeFrederickEvidence: SpeciesEvidence[] = [
  {
    speciesId: "largemouth-bass",
    availability: 0.82,
    quality: 0.64,
    evidenceConfidence: 0.76,
    evidenceType: "official listing",
    evidenceSummary: "A Virginia DWR regional fisheries feature lists largemouth bass at Lake Frederick.",
    lastEvidence: "DWR source reviewed 2026-07-13",
    technique: "Compact jig or Texas-rigged worm around edge cover",
    depth: "Shallow at first light; 6–10 ft after sunrise",
    positive: ["Official species listing", "Defined public DWR access"],
    negative: ["Current water temperature unavailable"],
    sourceName: "Virginia Department of Wildlife Resources",
    sourceUrl: "https://dwr.virginia.gov/waterbody/lake-frederick/",
  },
  {
    speciesId: "black-crappie",
    availability: 0.76,
    quality: null,
    evidenceConfidence: 0.68,
    evidenceType: "official listing",
    evidenceSummary: "A Virginia DWR regional fisheries feature lists crappie at Lake Frederick.",
    lastEvidence: "DWR source reviewed 2026-07-13",
    technique: "Small jig or minnow beside brush and shade",
    depth: "Mid-column",
    positive: ["Official species listing"],
    negative: ["Long-term quality metric unavailable"],
    sourceName: "Virginia Department of Wildlife Resources",
    sourceUrl: "https://dwr.virginia.gov/waterbody/lake-frederick/",
  },
];

const lakeBrittleEvidence: SpeciesEvidence[] = [
  {
    speciesId: "walleye",
    availability: 0.43,
    quality: 0.38,
    evidenceConfidence: 0.62,
    evidenceType: "agency survey",
    evidenceSummary:
      "DWR’s 2026 forecast reports no walleye in the 2025 survey, notes some may remain, and says current stocking focuses on saugeye. The contradiction intentionally limits this score.",
    lastEvidence: "2025 electrofishing; published 2026",
    technique: "Minnow-profile jig near the first break; treat walleye as a secondary target",
    depth: "Lower third",
    positive: ["Recent DWR electrofishing program", "Strong bank and boat access noted by DWR"],
    negative: ["No walleye collected in the 2025 survey", "Current stocking targets saugeye, not walleye"],
    sourceName: "Virginia Department of Wildlife Resources",
    sourceUrl: sourceLinks.walleye2026,
  },
];

const rappUpperSource = "https://dwr.virginia.gov/waterbody/rappahannock-river-upper/";
const rappTidalSource = "https://dwr.virginia.gov/waterbody/rappahannock-river-tidal/";
const rappReviewed = "DWR Rappahannock River waterbody page reviewed 2026-07-14";

const rappUpperSmallmouth = (): SpeciesEvidence => ({
  speciesId: "smallmouth-bass",
  availability: 0.85,
  quality: null,
  evidenceConfidence: 0.82,
  evidenceType: "official listing",
  evidenceSummary:
    "Virginia DWR describes the non-tidal upper Rappahannock as a smallmouth bass fishery; this uses the shared waterbody listing, not an angler report at this access point.",
  lastEvidence: rappReviewed,
  technique: "3–4 in. natural paddletail or craw tube along current breaks and ledges",
  depth: "Lower third of the water column; slide shallower in low light",
  positive: ["Virginia DWR documents smallmouth bass in the non-tidal Rappahannock", "Rocky current habitat matches the species profile"],
  negative: ["Hourly activity is a seasonal estimate until live providers refresh", "Evidence is the shared river listing, not this individual access point"],
  sourceName: "Virginia Department of Wildlife Resources",
  sourceUrl: rappUpperSource,
});

const rappUpperRedbreast = (): SpeciesEvidence => ({
  speciesId: "redbreast-sunfish",
  availability: 0.72,
  quality: null,
  evidenceConfidence: 0.74,
  evidenceType: "official listing",
  evidenceSummary: "Virginia DWR lists redbreast sunfish in the non-tidal Rappahannock alongside smallmouth bass.",
  lastEvidence: rappReviewed,
  technique: "Small inline spinner, popper, or worm along shaded banks and current seams",
  depth: "Shallow cover and undercut banks",
  positive: ["Virginia DWR documents redbreast sunfish in the non-tidal Rappahannock"],
  negative: ["Evidence is the shared river listing, not this individual access point"],
  sourceName: "Virginia Department of Wildlife Resources",
  sourceUrl: rappUpperSource,
});

const rappTidalLargemouth = (): SpeciesEvidence => ({
  speciesId: "largemouth-bass",
  availability: 0.72,
  quality: null,
  evidenceConfidence: 0.74,
  evidenceType: "official listing",
  evidenceSummary: "Virginia DWR lists largemouth bass in the tidal Rappahannock below the fall line.",
  lastEvidence: rappReviewed,
  technique: "Texas-rigged worm or compact jig around tidal grass, wood, and creek mouths",
  depth: "Shallow cover on the appropriate tide stage",
  positive: ["Virginia DWR documents largemouth bass in the tidal Rappahannock"],
  negative: ["Tidal stage strongly affects access-point conditions", "Evidence is the shared river listing, not this individual access point"],
  sourceName: "Virginia Department of Wildlife Resources",
  sourceUrl: rappTidalSource,
});

const rappTidalCatfish = (): SpeciesEvidence => ({
  speciesId: "channel-catfish",
  availability: 0.7,
  quality: null,
  evidenceConfidence: 0.72,
  evidenceType: "official listing",
  evidenceSummary: "Virginia DWR lists channel catfish in the tidal Rappahannock.",
  lastEvidence: rappReviewed,
  technique: "Cut bait or nightcrawler on the bottom near channel edges and holes",
  depth: "Bottom, deeper holes and channel edges",
  positive: ["Virginia DWR documents channel catfish in the tidal Rappahannock"],
  negative: ["Evidence is the shared river listing, not this individual access point"],
  sourceName: "Virginia Department of Wildlife Resources",
  sourceUrl: rappTidalSource,
});

// Verified against the live DWR "DWR Maintained Boating Access Locations" ArcGIS
// layer (real coordinates) 2026-07-14. Closes the previously-absent Rappahannock
// watershed. Access-method mix reflects hand-launch vs. ramp sites.
const rappahannockLocations: Array<Omit<FishingLocationSeed, "accessAuthority" | "accessSourceUrl" | "sourceReviewed">> = [
  {
    id: "kellys-ford", name: "Kelly's Ford", waterbody: "Rappahannock River", waterbodyType: "river", county: "Culpeper",
    lat: 38.477044, lng: -77.780688, distanceMiles: 33, travelMinutes: 52, publicAccess: true,
    access: ["shore", "wade", "kayak", "boat"], aliases: ["Kellys Ford", "Rappahannock Kellys Ford"],
    notice: "Popular non-tidal upper-Rappahannock smallmouth float and wade access. Verify river level, weather alerts, and posted conditions before wading or launching.",
    flowStatus: "USGS association review pending", activityEstimate: 0.6, accessFit: 0.84, bestWindow: "6:20–9:10 AM",
    evidence: [rappUpperSmallmouth(), rappUpperRedbreast()],
  },
  {
    id: "motts-landing", name: "Motts", waterbody: "Rappahannock River", waterbodyType: "river", county: "Spotsylvania",
    lat: 38.313621, lng: -77.540637, distanceMiles: 38, travelMinutes: 58, publicAccess: true,
    access: ["shore", "kayak", "boat"], aliases: ["Motts Landing", "Motts Run access"],
    notice: "DWR boating access on the Rappahannock above Fredericksburg. Verify river level and posted conditions before launching.",
    flowStatus: "USGS association review pending", activityEstimate: 0.58, accessFit: 0.83, bestWindow: "6:20–9:10 AM",
    evidence: [rappUpperSmallmouth()],
  },
  {
    id: "fredericksburg-city-docks", name: "Fredericksburg City Docks", waterbody: "Rappahannock River", waterbodyType: "river", county: "Fredericksburg",
    lat: 38.296527, lng: -77.453134, distanceMiles: 40, travelMinutes: 58, publicAccess: true,
    access: ["shore", "kayak", "boat"], aliases: ["City Docks", "Fredericksburg Rappahannock"],
    notice: "Access at the fall line in Fredericksburg. Verify river level, tide influence near the fall line, and posted conditions.",
    flowStatus: "USGS association review pending", activityEstimate: 0.56, accessFit: 0.82, bestWindow: "6:20–9:10 AM",
    evidence: [rappUpperSmallmouth()],
  },
  {
    id: "hopyard-landing", name: "Hopyard Landing", waterbody: "Rappahannock River", waterbodyType: "river", county: "King George",
    lat: 38.244263, lng: -77.225825, distanceMiles: 44, travelMinutes: 64, publicAccess: true,
    access: ["shore", "kayak", "boat"], aliases: ["Hopyard"],
    notice: "Tidal Rappahannock DWR boating access below Fredericksburg. Tide stage strongly affects conditions; verify before launching.",
    flowStatus: "Tidal river · gage association pending", activityEstimate: 0.52, accessFit: 0.81, bestWindow: "Tide-dependent",
    evidence: [rappTidalLargemouth(), rappTidalCatfish()],
  },
];

const accessOnlyNotice =
  "Public access is verified by Virginia DWR. Species evidence has not yet cleared the Phase 1 evidence gate.";

const dwrLocations: Array<Omit<FishingLocationSeed, "accessAuthority" | "accessSourceUrl" | "sourceReviewed">> = [
  {
    id: "lake-burke",
    name: "Lake Burke",
    waterbody: "Lake Burke",
    waterbodyType: "lake",
    county: "Fairfax",
    lat: 38.756407,
    lng: -77.301343,
    distanceMiles: 17,
    travelMinutes: 31,
    publicAccess: true,
    access: ["shore", "kayak", "boat"],
    aliases: ["Burke Lake", "Burke Lake Park"],
    notice: "Check park hours, launch rules, and current DWR regulations before departure.",
    flowStatus: "Lake · flow not applicable",
    activityEstimate: 0.69,
    accessFit: 0.93,
    bestWindow: "6:05–8:45 AM",
    evidence: burkeEvidence,
  },
  {
    id: "lake-brittle",
    name: "Lake Brittle",
    waterbody: "Lake Brittle",
    waterbodyType: "lake",
    county: "Fauquier",
    lat: 38.747826,
    lng: -77.691239,
    distanceMiles: 25,
    travelMinutes: 38,
    publicAccess: true,
    access: ["shore", "kayak", "boat"],
    aliases: ["Brittle Lake"],
    notice: "Species evidence distinguishes walleye from the lake’s current saugeye program.",
    flowStatus: "Lake · live temperature pending",
    activityEstimate: 0.64,
    accessFit: 0.94,
    bestWindow: "5:50–8:20 AM",
    evidence: lakeBrittleEvidence,
  },
  {
    id: "lake-frederick",
    name: "Lake Frederick",
    waterbody: "Wheatlands Lake",
    waterbodyType: "lake",
    county: "Frederick",
    lat: 39.043012,
    lng: -78.156883,
    distanceMiles: 47,
    travelMinutes: 57,
    publicAccess: true,
    access: ["shore", "kayak", "boat"],
    aliases: ["Wheatlands Lake"],
    notice: "Outside the default 45-minute drive for many NOVA starting points.",
    flowStatus: "Lake · live temperature pending",
    activityEstimate: 0.68,
    accessFit: 0.88,
    bestWindow: "6:10–8:50 AM",
    evidence: lakeFrederickEvidence,
  },
  {
    id: "point-of-rocks",
    name: "McKimmey (Point of Rocks)",
    waterbody: "Potomac River",
    waterbodyType: "river",
    county: "Loudoun",
    lat: 39.272516,
    lng: -77.546888,
    distanceMiles: 34,
    travelMinutes: 48,
    publicAccess: true,
    access: ["shore", "kayak", "boat"],
    aliases: ["Point of Rocks", "McKimmey"],
    notice: accessOnlyNotice,
    flowStatus: "Representative gage not yet verified",
    activityEstimate: 0.5,
    accessFit: 0.78,
    bestWindow: "Unavailable",
    evidence: [],
  },
  {
    id: "lake-curtis",
    name: "Lake Curtis",
    waterbody: "Lake Curtis",
    waterbodyType: "reservoir",
    county: "Stafford",
    lat: 38.436285,
    lng: -77.56126,
    distanceMiles: 43,
    travelMinutes: 54,
    publicAccess: true,
    access: ["shore", "kayak", "boat"],
    aliases: ["Curtis Lake"],
    notice: accessOnlyNotice,
    flowStatus: "Live water data unavailable",
    activityEstimate: 0.5,
    accessFit: 0.84,
    bestWindow: "Unavailable",
    evidence: [],
  },
  {
    id: "rocky-pen-park",
    name: "Rocky Pen Park",
    waterbody: "Rocky Pen Run Reservoir",
    waterbodyType: "reservoir",
    county: "Stafford",
    lat: 38.334227,
    lng: -77.543775,
    distanceMiles: 50,
    travelMinutes: 62,
    publicAccess: true,
    access: ["shore", "kayak", "boat"],
    aliases: ["Rocky Pen Run"],
    notice: accessOnlyNotice,
    flowStatus: "Live water data unavailable",
    activityEstimate: 0.5,
    accessFit: 0.82,
    bestWindow: "Unavailable",
    evidence: [],
  },
  ...[
    ["berrys", "Berry’s", "Shenandoah River", "Clarke", 39.041631, -77.999671, 43, 54, ["shore", "kayak", "boat"], 0.75, 0.83],
    ["castlemans-ferry", "Castleman’s Ferry", "Shenandoah River", "Clarke", 39.123933, -77.891047, 45, 57, ["shore", "kayak", "boat"], 0.73, 0.88],
    ["lockes", "Lockes", "Shenandoah River", "Clarke", 39.101569, -77.964838, 46, 58, ["shore", "kayak", "boat"], 0.71, 0.82],
    ["bentonville", "Bentonville", "South Fork Shenandoah River", "Warren", 38.840096, -78.33042, 58, 68, ["shore", "wade", "kayak", "boat"], 0.78, 0.91],
    ["catletts-ford", "Catletts Ford Landing", "North Fork Shenandoah River", "Warren", 38.978482, -78.258715, 52, 64, ["shore", "wade", "kayak", "boat"], 0.72, 0.9],
    ["front-royal", "Front Royal", "South Fork Shenandoah River", "Warren", 38.913697, -78.20974, 46, 56, ["shore", "kayak", "boat"], 0.76, 0.92],
    ["karo", "Karo", "South Fork Shenandoah River", "Warren", 38.871521, -78.252644, 51, 61, ["shore", "wade", "kayak", "boat"], 0.8, 0.88],
    ["morgans-ford", "Morgan’s Ford", "Main Stem Shenandoah River", "Warren", 38.957833, -78.121708, 45, 55, ["shore", "wade", "kayak", "boat"], 0.82, 0.94],
    ["riverton", "Riverton", "North Fork Shenandoah River", "Warren", 38.949632, -78.198084, 48, 58, ["shore", "kayak", "boat"], 0.74, 0.91],
    ["simpsons", "Simpson’s", "South Fork Shenandoah River", "Warren", 38.878751, -78.261977, 53, 64, ["shore", "wade", "kayak", "boat"], 0.77, 0.89],
  ].map((row) => {
    const [id, name, waterbody, county, lat, lng, distanceMiles, travelMinutes, access, activityEstimate, accessFit] = row as [string, string, string, string, number, number, number, number, AccessMethod[], number, number];
    const segment = waterbody === "Main Stem Shenandoah River" || waterbody === "Shenandoah River"
      ? "main-stem"
      : waterbody === "North Fork Shenandoah River"
        ? "north-fork"
        : "south-fork";
    const mainStem = segment === "main-stem";
    return {
      id,
      name,
      waterbody,
      waterbodyType: "river" as const,
      county,
      lat,
      lng,
      distanceMiles,
      travelMinutes,
      publicAccess: true,
      access,
      aliases: [name.replace(/[’']/g, "")],
      notice: "Verify river level, weather alerts, and posted access conditions before wading or launching.",
      flowStatus: "USGS association review pending",
      activityEstimate,
      accessFit,
      bestWindow: "6:20–9:10 AM",
      evidence: [shenandoahSmallmouth("DWR source reviewed 2026-07-14", segment), ...(mainStem ? [shenandoahWalleye("DWR source reviewed 2026-07-14")] : [])],
    };
  }),
  ...rappahannockLocations,
];

const curatedLocations: FishingLocationSeed[] = [
  ...dwrLocations.map((location) => ({
    ...location,
    accessAuthority: "Virginia Department of Wildlife Resources",
    accessSourceUrl: sourceLinks.access,
    sourceReviewed: "2026-07-13",
  })),
  ...coverageLocations,
  ...troutLocations,
];

// Layer in region-wide public waters not already curated (deduped by proximity +
// name): DWR boating-access sites (agency-verified) and named NHD waters on public
// parkland (access "listed"). Private waters are never added.
const toPoint = (location: FishingLocationSeed) => ({
  id: location.id,
  name: location.name,
  lat: location.lat,
  lng: location.lng,
  waterbody: location.waterbody,
});
const curatedPoints = curatedLocations.map(toPoint);
const dwrAdded = dwrAccessLocations(curatedPoints);
const nhdAdded = nhdParkWaterLocations([...curatedPoints, ...dwrAdded.map(toPoint)]);
const streamAdded = nhdStreamLocations([...curatedPoints, ...dwrAdded.map(toPoint), ...nhdAdded.map(toPoint)]);

const sourcedLocations: FishingLocationSeed[] = [...curatedLocations, ...dwrAdded, ...nhdAdded, ...streamAdded];

const rejectedEvidenceClaimKeys = new Set(
  evidenceRejections.claims.map((claim) =>
    `${claim.locationId}\u0000${claim.speciesId}\u0000${claim.sourceUrl ?? ""}`
  ),
);
const evidenceAllowed = (locationId: string, evidence: SpeciesEvidence) =>
  evidence.evidenceType === "modeled" || evidence.modeled || !rejectedEvidenceClaimKeys.has(
    `${locationId}\u0000${evidence.speciesId}\u0000${evidence.sourceUrl ?? ""}`,
  );

const advisoryEvidenceForLocation = (location: FishingLocationSeed): SpeciesEvidence[] => {
  const advisory = advisoryForLocation(location);
  const bySpecies = new Map<string, { labels: Set<string>; waterbodies: Set<string>; versions: Set<string>; sourceUrl: string }>();
  for (const segment of advisory.segments) {
    for (const restriction of segment.restrictions) {
      for (const speciesId of restriction.evidenceSpeciesIds) {
        const claim = bySpecies.get(speciesId) ?? {
          labels: new Set<string>(),
          waterbodies: new Set<string>(),
          versions: new Set<string>(),
          sourceUrl: segment.sourceUrl,
        };
        claim.labels.add(restriction.speciesLabel);
        claim.waterbodies.add(segment.waterbody);
        claim.versions.add(segment.sourceVersion);
        bySpecies.set(speciesId, claim);
      }
    }
  }
  return [...bySpecies.entries()].map(([speciesId, claim]) => ({
    speciesId,
    availability: 0.7,
    quality: null,
    evidenceConfidence: 0.74,
    evidenceType: "official listing",
    evidenceSummary: `Virginia VDH's current fish-consumption advisory names ${[...claim.labels].join(" / ")} for ${[...claim.waterbodies].join(" and ")}. This supports occurrence in the mapped river segment, not a survey at this individual access point.`,
    lastEvidence: [...claim.versions].join("; "),
    technique: "Match presentation to the species, season, current, and visible habitat",
    depth: "Begin around accessible cover and current breaks; adjust to actual conditions",
    positive: ["Current, official species-specific restriction for the mapped waterbody segment"],
    negative: [
      "A consumption advisory is not an abundance or fishery-quality survey",
      "The named segment is broader than this individual access point",
    ],
    sourceName: "Virginia Department of Health",
    sourceUrl: claim.sourceUrl,
  }));
};

export const locations: FishingLocation[] = sourcedLocations.map((location) => {
  const has = (list: SpeciesEvidence[], speciesId: string) => list.some((item) => item.speciesId === speciesId);
  const curatedEvidence = location.evidence.filter((candidate) => evidenceAllowed(location.id, candidate));
  // Approved agency candidates promoted from the review pipeline (e.g. DWR wild
  // trout reaches). Adversarially approved in fish-community-verdicts.json.
  const promotedEvidence = promotedEvidenceFor(location.id)
    .filter((candidate) => !has(curatedEvidence, candidate.speciesId));
  // Documented-waterbody agency listings layer under curated evidence.
  const waterbodyEvidence = waterbodySpeciesFor(location)
    .filter((candidate) => evidenceAllowed(location.id, candidate))
    .filter((candidate) => !has(curatedEvidence, candidate.speciesId) && !has(promotedEvidence, candidate.speciesId));
  const withWaterbody = [...curatedEvidence, ...promotedEvidence, ...waterbodyEvidence];
  // A current VDH species-specific restriction supports occurrence in its
  // precisely mapped waterbody segment. Generic groups (for example "sunfish")
  // and "all species" rules are deliberately excluded from presence evidence.
  const advisoryEvidence = advisoryEvidenceForLocation(location)
    .filter((candidate) => evidenceAllowed(location.id, candidate))
    .filter((candidate) => !has(withWaterbody, candidate.speciesId));
  const withAdvisory = [...withWaterbody, ...advisoryEvidence];
  // Modeled nearby-reach (Aquatic GAP) evidence fills any remaining gaps.
  const aquaticGapEvidence = aquaticGapEvidenceForLocation(location)
    .filter((candidate) => evidenceAllowed(location.id, candidate))
    .filter((candidate) => !has(withAdvisory, candidate.speciesId));
  const documented = [...withAdvisory, ...aquaticGapEvidence];
  // Only when a water has no documented evidence at all, add honest, cited
  // "likely present" species (same-waterbody / downstream connectivity /
  // subwatershed survey records). Waters with no real basis stay empty.
  const inferred = documented.length === 0 ? likelyPresentFor(location) : [];
  const hydrology = hydrologyForLocation(location.id);
  return {
    ...location,
    accessStatus: location.accessStatus ?? "verified",
    flowStatus: hydrology ? `USGS ${hydrology.stationId} linked · live reading on details` : location.flowStatus,
    evidence: [...documented, ...inferred],
    hydrology,
    consumptionAdvisory: advisoryForLocation(location),
  };
});

export const locationById = (id: string) => locations.find((location) => location.id === id);
export const speciesById = (id: string) => species.find((item) => item.id === id);
