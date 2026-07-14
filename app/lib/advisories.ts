export type AdvisoryStatus = "active" | "no-advisory-found" | "no-selected-species-match" | "jurisdiction-check";
export type AdvisorySeverity = "do-not-eat" | "two-meals-per-month";

export type AdvisoryRestriction = {
  id: string;
  severity: AdvisorySeverity;
  label: string;
  speciesLabel: string;
  speciesIds: string[];
  appliesToAllSpecies?: boolean;
  contaminant: string;
  sizeQualifier?: string;
};

export type AdvisorySegment = {
  id: string;
  basin: string;
  waterbody: string;
  section: string;
  localities: string;
  contaminants: string[];
  restrictions: AdvisoryRestriction[];
  locationIds: string[];
  sourceUrl: string;
  sourceVersion: string;
};

export type ConsumptionAdvisory = {
  status: AdvisoryStatus;
  label: string;
  summary: string;
  contaminants: string[];
  sourceName: string;
  sourceUrl: string;
  reviewed: string;
  segments: AdvisorySegment[];
  matchingRestrictions: AdvisoryRestriction[];
  selectedSpeciesIds: string[];
};

export const vdhAdvisoryIndexUrl = "https://www.vdh.virginia.gov/environmental-health/public-health-toxicology/fish-consumption-advisory/";
export const vdhPotomac2026Url = "https://www.vdh.virginia.gov/content/uploads/sites/20/PotomacRiver_2026-1.pdf";
export const vdhShenandoah2025Url = "https://www.vdh.virginia.gov/content/uploads/sites/20/2025/06/ShenandoahRiver_2025.pdf";

const twoMeals = (id: string, speciesLabel: string, speciesIds: string[], contaminant: string, sizeQualifier?: string): AdvisoryRestriction => ({
  id,
  severity: "two-meals-per-month",
  label: "No more than 2 meals/month",
  speciesLabel,
  speciesIds,
  contaminant,
  sizeQualifier,
});

const doNotEat = (id: string, speciesLabel: string, speciesIds: string[], contaminant: string, sizeQualifier?: string): AdvisoryRestriction => ({
  id,
  severity: "do-not-eat",
  label: "Do not eat",
  speciesLabel,
  speciesIds,
  contaminant,
  sizeQualifier,
});

const shenandoahPcbLocations = ["front-royal", "riverton", "morgans-ford", "berrys", "castlemans-ferry", "lockes"];
const shenandoahMercuryLocations = ["bentonville", "karo", "simpsons", "front-royal", "riverton"];
const tidalPotomacTributaryLocations = ["pohick-bay", "occoquan-regional"];
const occoquanPfosLocations = ["fountainhead", "bull-run-marina", "lake-ridge-marina", "occoquan-regional", "mason-neck"];

export const advisorySegments: AdvisorySegment[] = [
  {
    id: "shenandoah-pcb-lower-reaches",
    basin: "Shenandoah River Basin",
    waterbody: "Lower South Fork, lower North Fork, and main-stem Shenandoah River",
    section: "South Fork downstream from the Route 619 bridge near Front Royal to the confluence; North Fork from its mouth upstream to Riverton Dam; and the Shenandoah from the fork confluence to the Virginia/West Virginia line.",
    localities: "Warren and Clarke counties",
    contaminants: ["PCBs"],
    restrictions: [
      doNotEat("shen-pcb-carp", "Carp", ["common-carp"], "PCBs"),
      doNotEat("shen-pcb-channel-cat", "Channel Catfish", ["channel-catfish"], "PCBs"),
      doNotEat("shen-pcb-white-sucker", "White Sucker", [], "PCBs"),
      twoMeals("shen-pcb-rock-bass", "Rock Bass", [], "PCBs"),
      twoMeals("shen-pcb-sunfish", "Sunfish", ["bluegill", "redbreast-sunfish"], "PCBs"),
      twoMeals("shen-pcb-smallmouth", "Smallmouth Bass", ["smallmouth-bass"], "PCBs"),
      twoMeals("shen-pcb-largemouth", "Largemouth Bass", ["largemouth-bass"], "PCBs"),
    ],
    locationIds: shenandoahPcbLocations,
    sourceUrl: vdhShenandoah2025Url,
    sourceVersion: "Current VDH Shenandoah basin sheet · 2025",
  },
  {
    id: "shenandoah-mercury",
    basin: "Shenandoah River Basin",
    waterbody: "South Fork, lower North Fork, and upper main-stem Shenandoah River",
    section: "South Fork from Port Republic to the fork confluence; North Fork from its mouth upstream to Riverton Dam; and the Shenandoah from the fork confluence to Warren Power Dam just north of Front Royal.",
    localities: "Warren, Page, Rockingham, and Augusta counties",
    contaminants: ["Mercury"],
    restrictions: [{
      ...twoMeals("shen-mercury-all", "All species", [], "Mercury"),
      appliesToAllSpecies: true,
    }],
    locationIds: shenandoahMercuryLocations,
    sourceUrl: vdhShenandoah2025Url,
    sourceVersion: "Current VDH Shenandoah basin sheet · 2025",
  },
  {
    id: "potomac-tidal-tributaries-pcb",
    basin: "Potomac River Basin",
    waterbody: "Tidal Potomac tributaries and embayments",
    section: "Tidal portions of the named tributaries and embayments between the I-395 bridge and the Route 301 Potomac River bridge, including Pohick Creek and the Occoquan River system.",
    localities: "Arlington, Alexandria, Fairfax, Prince William, Stafford, and King George",
    contaminants: ["PCBs"],
    restrictions: [
      doNotEat("potomac-pcb-carp", "Carp", ["common-carp"], "PCBs"),
      doNotEat("potomac-pcb-eel", "American Eel", [], "PCBs"),
      doNotEat("potomac-pcb-channel-large", "Channel Catfish", ["channel-catfish"], "PCBs", "18 inches or longer"),
      twoMeals("potomac-pcb-channel-small", "Channel Catfish", ["channel-catfish"], "PCBs", "shorter than 18 inches"),
      twoMeals("potomac-pcb-bullhead", "Bullhead Catfish", [], "PCBs"),
      twoMeals("potomac-pcb-largemouth", "Largemouth Bass", ["largemouth-bass"], "PCBs"),
      twoMeals("potomac-pcb-striped", "Anadromous Striped Bass", ["striped-bass"], "PCBs"),
      twoMeals("potomac-pcb-sunfish", "Sunfish species", ["bluegill", "redbreast-sunfish"], "PCBs"),
      twoMeals("potomac-pcb-smallmouth", "Smallmouth Bass", ["smallmouth-bass"], "PCBs"),
      twoMeals("potomac-pcb-white-cat", "White Catfish", [], "PCBs"),
      twoMeals("potomac-pcb-white-perch", "White Perch", ["white-perch"], "PCBs"),
      twoMeals("potomac-pcb-gizzard", "Gizzard Shad", [], "PCBs"),
      twoMeals("potomac-pcb-yellow-perch", "Yellow Perch", ["yellow-perch"], "PCBs"),
    ],
    locationIds: tidalPotomacTributaryLocations,
    sourceUrl: vdhPotomac2026Url,
    sourceVersion: "Current VDH Potomac basin sheet · 2026",
  },
  {
    id: "occoquan-pfos",
    basin: "Potomac River Basin",
    waterbody: "Occoquan River and Occoquan Reservoir",
    section: "The tidal Occoquan below the reservoir dam through Occoquan Bay and Belmont Bay, plus the reservoir from its named Bull Run and Occoquan River backwater boundaries to the Fairfax Water supply dam.",
    localities: "Fairfax and Prince William counties",
    contaminants: ["PFOS"],
    restrictions: [
      doNotEat("occoquan-pfos-largemouth", "Largemouth Bass", ["largemouth-bass"], "PFOS"),
      twoMeals("occoquan-pfos-bluegill", "Bluegill Sunfish", ["bluegill"], "PFOS"),
    ],
    locationIds: occoquanPfosLocations,
    sourceUrl: vdhPotomac2026Url,
    sourceVersion: "Current VDH Potomac basin sheet · 2026",
  },
];

const jurisdictionCheckIds = new Set(["occoquan-hand-carry", "roaches-run"]);

export function advisoryForLocation(location: { id: string; waterbody: string }): ConsumptionAdvisory {
  const segments = advisorySegments.filter((segment) => segment.locationIds.includes(location.id));
  const common = {
    sourceName: "Virginia Department of Health",
    sourceUrl: vdhAdvisoryIndexUrl,
    reviewed: "2026-07-13",
    selectedSpeciesIds: [] as string[],
  };

  if (segments.length > 0) {
    const matchingRestrictions = segments.flatMap((segment) => segment.restrictions);
    const contaminants = [...new Set(segments.flatMap((segment) => segment.contaminants))];
    return {
      ...common,
      status: "active",
      label: segments.some((segment) => segment.restrictions.some((rule) => rule.severity === "do-not-eat")) ? "VDH consumption restrictions" : "VDH consumption advisory",
      summary: `${segments.length} current VDH advisory segment${segments.length === 1 ? " applies" : "s apply"} at this access point. Restrictions depend on species and, for channel catfish, fish length.`,
      contaminants,
      segments,
      matchingRestrictions,
    };
  }

  if (location.waterbody === "Potomac River" || jurisdictionCheckIds.has(location.id)) {
    return {
      ...common,
      status: "jurisdiction-check",
      label: location.id === "occoquan-hand-carry" ? "Check advisory boundary" : "Check exact jurisdiction",
      summary: location.id === "occoquan-hand-carry"
        ? "This access is upstream of the named Occoquan PFOS boundary near Davis Ford Road. Confirm the exact harvest location against the current VDH segment before keeping fish."
        : "Potomac harvest guidance can depend on the exact Virginia, Maryland, or DC bank, tributary, and river segment. Check the authority for the precise place where the fish was caught.",
      contaminants: [],
      segments: [],
      matchingRestrictions: [],
    };
  }

  return {
    ...common,
    status: "no-advisory-found",
    label: "No VDH advisory match found",
    summary: "No matching access-point segment was found in the current VDH table during this review. That is not a guarantee that fish are safe to eat.",
    contaminants: [],
    segments: [],
    matchingRestrictions: [],
  };
}

function restrictionMatchesSpecies(restriction: AdvisoryRestriction, speciesIds: string[]) {
  return restriction.appliesToAllSpecies || restriction.speciesIds.some((speciesId) => speciesIds.includes(speciesId));
}

export function consumptionAdviceFor(advisory: ConsumptionAdvisory, speciesIds: string[]): ConsumptionAdvisory {
  if (speciesIds.length === 0 || advisory.status !== "active") return { ...advisory, selectedSpeciesIds: speciesIds };

  const matchingRestrictions = advisory.matchingRestrictions.filter((restriction) => restrictionMatchesSpecies(restriction, speciesIds));
  if (matchingRestrictions.length === 0) {
    return {
      ...advisory,
      status: "no-selected-species-match",
      label: "No selected-species restriction found",
      summary: "This water has a VDH advisory, but the current table does not list the selected species for this mapped segment. That is not a general safety guarantee.",
      matchingRestrictions: [],
      selectedSpeciesIds: speciesIds,
    };
  }

  const hasDoNotEat = matchingRestrictions.some((restriction) => restriction.severity === "do-not-eat");
  return {
    ...advisory,
    label: hasDoNotEat ? "Do not eat selected catch" : "Limit selected catch",
    summary: hasDoNotEat
      ? "At least one selected species has current VDH do-not-eat guidance for this mapped segment."
      : "At least one selected species is limited to no more than two meals per month in this mapped segment.",
    matchingRestrictions,
    selectedSpeciesIds: speciesIds,
  };
}
