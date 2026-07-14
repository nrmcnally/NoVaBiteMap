import { coverageLocations } from "./coverage-data";

export type AccessMethod = "shore" | "wade" | "kayak" | "boat";
export type WaterbodyType = "river" | "reservoir" | "lake" | "pond" | "bay" | "stream";
export type AdvisoryStatus = "active" | "no-advisory-found" | "jurisdiction-check";

export type ConsumptionAdvisory = {
  status: AdvisoryStatus;
  label: string;
  summary: string;
  contaminants: string[];
  sourceName: string;
  sourceUrl: string;
  reviewed: string;
};

export type Species = {
  id: string;
  name: string;
  scientificName: string;
  short: string;
  habitat: string;
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
  consumptionAdvisory: ConsumptionAdvisory;
};

export type FishingLocationSeed = Omit<FishingLocation, "consumptionAdvisory">;

export const sourceLinks = {
  access:
    "https://services.dwr.virginia.gov/arcgis/rest/services/Public/BoatingAccessSites/FeatureServer/0",
  shenandoah:
    "https://dwr.virginia.gov/blog/five-great-places-in-the-northern-shenandoah-valley-to-fish-after-work/",
  walleye2026:
    "https://dwr.virginia.gov/wp-content/uploads/media/Walleye-Fishing-Forecast-2026.pdf",
  aquaticGap:
    "https://www.usgs.gov/data/aquatic-gap-analysis-project-aquatic-gap-aquatic-species-distribution-modeling-national",
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
  vdhFishAdvisories: "https://www.vdh.virginia.gov/environmental-health/public-health-toxicology/fish-consumption-advisory/",
};

export const species: Species[] = [
  { id: "smallmouth-bass", name: "Smallmouth bass", scientificName: "Micropterus dolomieu", short: "SMB", habitat: "Rocky rivers, current seams, ledges" },
  { id: "largemouth-bass", name: "Largemouth bass", scientificName: "Micropterus salmoides", short: "LMB", habitat: "Vegetated lakes, reservoirs, woody cover" },
  { id: "spotted-bass", name: "Spotted bass", scientificName: "Micropterus punctulatus", short: "SPB", habitat: "Reservoirs and flowing water where supported" },
  { id: "bluegill", name: "Bluegill", scientificName: "Lepomis macrochirus", short: "BG", habitat: "Shallow cover, docks, vegetation" },
  { id: "redbreast-sunfish", name: "Redbreast sunfish", scientificName: "Lepomis auritus", short: "RBS", habitat: "Warm, rocky rivers and creeks" },
  { id: "black-crappie", name: "Black crappie", scientificName: "Pomoxis nigromaculatus", short: "BCP", habitat: "Brush, docks, suspended schools" },
  { id: "white-crappie", name: "White crappie", scientificName: "Pomoxis annularis", short: "WCP", habitat: "Turbid reservoirs and woody cover" },
  { id: "channel-catfish", name: "Channel catfish", scientificName: "Ictalurus punctatus", short: "CCF", habitat: "Pools, channels, reservoirs" },
  { id: "blue-catfish", name: "Blue catfish", scientificName: "Ictalurus furcatus", short: "BCF", habitat: "Large tidal rivers and channels" },
  { id: "flathead-catfish", name: "Flathead catfish", scientificName: "Pylodictis olivaris", short: "FCF", habitat: "Deep river holes and wood" },
  { id: "rainbow-trout", name: "Rainbow trout", scientificName: "Oncorhynchus mykiss", short: "RBT", habitat: "Cool stocked and coldwater streams" },
  { id: "brown-trout", name: "Brown trout", scientificName: "Salmo trutta", short: "BNT", habitat: "Cool streams with cover" },
  { id: "brook-trout", name: "Brook trout", scientificName: "Salvelinus fontinalis", short: "BKT", habitat: "Cold headwater streams" },
  { id: "common-carp", name: "Common carp", scientificName: "Cyprinus carpio", short: "CARP", habitat: "Slow rivers, reservoirs, flats" },
  { id: "northern-snakehead", name: "Northern snakehead", scientificName: "Channa argus", short: "NSH", habitat: "Tidal vegetation and backwaters" },
  { id: "walleye", name: "Walleye", scientificName: "Sander vitreus", short: "WAE", habitat: "Rivers and reservoirs where supported" },
  { id: "yellow-perch", name: "Yellow perch", scientificName: "Perca flavescens", short: "YEP", habitat: "Reservoir edges and tidal tributaries" },
  { id: "white-perch", name: "White perch", scientificName: "Morone americana", short: "WHP", habitat: "Tidal fresh and brackish water" },
  { id: "striped-bass", name: "Striped bass", scientificName: "Morone saxatilis", short: "STB", habitat: "Large reservoirs and tidal rivers" },
  { id: "muskellunge", name: "Muskellunge", scientificName: "Esox masquinongy", short: "MUS", habitat: "Large rivers where agency evidence supports them" },
];

const shenandoahSmallmouth = (freshness: string): SpeciesEvidence => ({
  speciesId: "smallmouth-bass",
  availability: 0.91,
  quality: 0.78,
  evidenceConfidence: 0.88,
  evidenceType: "official listing",
  evidenceSummary:
    "Virginia DWR identifies the Shenandoah as a smallmouth fishery; this score uses the shared waterbody listing, not an angler report.",
  lastEvidence: freshness,
  technique: "3–4 in. natural paddletail or craw tube along current breaks",
  depth: "Lower third of the water column; slide shallower in low light",
  positive: ["Strong official waterbody evidence", "Rocky current habitat matches the species profile"],
  negative: ["Hourly activity is a seasonal estimate until live providers refresh", "Access-point conditions can differ along the river"],
});

const shenandoahWalleye = (freshness: string): SpeciesEvidence => ({
  speciesId: "walleye",
  availability: 0.74,
  quality: 0.63,
  evidenceConfidence: 0.74,
  evidenceType: "official listing",
  evidenceSummary:
    "Virginia DWR describes walleye in the main-stem Shenandoah; connected-fork access points receive lower directness.",
  lastEvidence: freshness,
  technique: "Small minnow-profile jig worked slowly near deeper seams",
  depth: "Deep current edge, especially near dawn and dusk",
  positive: ["Official regional fishery evidence"],
  negative: ["Evidence is broader than this individual access point"],
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
    ["berrys", "Berry’s", "South Fork Shenandoah River", "Clarke", 39.041631, -77.999671, 43, 54, ["shore", "kayak", "boat"], 0.75, 0.83],
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
    const mainStem = waterbody === "Main Stem Shenandoah River" || waterbody === "Shenandoah River";
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
      evidence: [shenandoahSmallmouth("DWR source reviewed 2026-07-13"), ...(mainStem ? [shenandoahWalleye("DWR source reviewed 2026-07-13")] : [])],
    };
  }),
];

const sourcedLocations: FishingLocationSeed[] = [
  ...dwrLocations.map((location) => ({
    ...location,
    accessAuthority: "Virginia Department of Wildlife Resources",
    accessSourceUrl: sourceLinks.access,
    sourceReviewed: "2026-07-13",
  })),
  ...coverageLocations,
];

const occoquanAdvisoryIds = new Set([
  "fountainhead",
  "bull-run-marina",
  "lake-ridge-marina",
  "occoquan-regional",
  "mason-neck",
]);

function consumptionAdvisoryFor(location: FishingLocationSeed): ConsumptionAdvisory {
  const common = {
    sourceName: "Virginia Department of Health",
    sourceUrl: sourceLinks.vdhFishAdvisories,
    reviewed: "2026-07-13",
  };

  if (location.waterbody.includes("Shenandoah")) {
    return {
      ...common,
      status: "active",
      label: "VDH consumption advisory",
      summary: "VDH lists PCB and mercury meal limits across Shenandoah segments, including do-not-eat guidance for some species and reaches.",
      contaminants: ["PCBs", "Mercury"],
    };
  }

  if (occoquanAdvisoryIds.has(location.id)) {
    return {
      ...common,
      status: "active",
      label: "VDH PFOS advisory",
      summary: "VDH advises no largemouth bass meals from specified Occoquan River and Reservoir reaches and limits bluegill in the wider watershed.",
      contaminants: ["PFOS"],
    };
  }

  if (location.id === "pohick-bay") {
    return {
      ...common,
      status: "active",
      label: "VDH PCB advisory",
      summary: "VDH lists species-specific PCB restrictions for tidal Potomac tributaries and embayments that include Pohick Creek.",
      contaminants: ["PCBs"],
    };
  }

  if (location.waterbody === "Potomac River") {
    return {
      ...common,
      status: "jurisdiction-check",
      label: "Check exact jurisdiction",
      summary: "Potomac harvest guidance can depend on the exact Virginia, Maryland, or DC bank and river segment. Check the applicable advisory before keeping fish.",
      contaminants: [],
    };
  }

  return {
    ...common,
    status: "no-advisory-found",
    label: "No VDH advisory match found",
    summary: "No matching location was found in the current VDH table during this review. That is not a guarantee that fish are safe to eat.",
    contaminants: [],
  };
}

export const locations: FishingLocation[] = sourcedLocations.map((location) => ({
  ...location,
  consumptionAdvisory: consumptionAdvisoryFor(location),
}));

export const locationById = (id: string) => locations.find((location) => location.id === id);
export const speciesById = (id: string) => species.find((item) => item.id === id);
