import type { AccessCondition, AccessMethod, FishingLocationSeed, SpeciesEvidence } from "./data";

const sourceReviewDate = "2026-07-18";
const reviewed = `Official source reviewed ${sourceReviewDate}`;

const sources = {
  fairfaxFishing: "https://www.fairfaxcounty.gov/parks/fishing",
  fairfaxSmallLakes: "https://www.fairfaxcounty.gov/parks/small-lakes",
  npsGwmp: "https://www.nps.gov/gwmp/planyourvisit/fishing.htm",
  npsGreatFalls: "https://www.nps.gov/grfa/planyourvisit/outdooractivities.htm",
  novaFountainhead: "https://www.novaparks.com/parks/fountainhead-regional-park/things-to-do/fishing",
  novaBullRun: "https://www.novaparks.com/parks/bull-run-marina/things-to-do/fishing",
  novaBullRunPark: "https://www.novaparks.com/parks/bull-run-regional-park",
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
  alexandriaLakeCook: "https://www.alexandriava.gov/parks/location/lake-cook",
  fairfaxCityParks: "https://www.fairfaxva.gov/Fun-Facilities/Parks",
  arlingtonStreams: "https://www.arlingtonva.us/Government/Programs/Sustainability/Streams",
  blmMeadowood: "https://www.blm.gov/visit/meadowood-recreation-area",
};

type EvidenceSeed = {
  speciesId: string;
  summary: string;
  sourceName: string;
  sourceUrl: string;
  availability: number;
  quality?: number | null;
  confidence?: number;
  technique?: string;
  depth?: string;
  limits?: string[];
};

const officialEvidence = (seed: EvidenceSeed): SpeciesEvidence => ({
  speciesId: seed.speciesId,
  availability: seed.availability,
  quality: seed.quality ?? null,
  evidenceConfidence: seed.confidence ?? 0.76,
  evidenceType: "official listing",
  evidenceSummary: seed.summary,
  lastEvidence: reviewed,
  technique: seed.technique ?? "Start with a compact presentation near visible cover and adjust to the actual water",
  depth: seed.depth ?? "Work the most accessible cover first, then probe the first depth change",
  positive: [`Named by ${seed.sourceName} for this waterbody or park`],
  negative: seed.limits ?? ["No current site-specific population survey is attached yet"],
  sourceName: seed.sourceName,
  sourceUrl: seed.sourceUrl,
});

const fairfaxName = "Fairfax County Park Authority";
const novaName = "NOVA Parks";
const pwcName = "Prince William County Parks";

const lakeFairfaxEvidence = [
  officialEvidence({ speciesId: "bluegill", availability: 0.8, quality: 0.58, sourceName: fairfaxName, sourceUrl: sources.fairfaxFishing, summary: "Fairfax County specifically lists bluegill at Lake Fairfax." }),
  officialEvidence({ speciesId: "black-crappie", availability: 0.7, sourceName: fairfaxName, sourceUrl: sources.fairfaxFishing, summary: "Fairfax County specifically lists black crappie at Lake Fairfax." }),
];

const riverbendEvidence = [
  officialEvidence({ speciesId: "smallmouth-bass", availability: 0.86, quality: 0.7, confidence: 0.86, sourceName: fairfaxName, sourceUrl: sources.fairfaxFishing, summary: "Fairfax County describes Riverbend's rocky Potomac reach as excellent smallmouth bass habitat.", technique: "Work a small tube or paddletail beside current seams and boulders", depth: "Start along the lower third of current breaks; avoid entering the river" }),
  officialEvidence({ speciesId: "channel-catfish", availability: 0.72, confidence: 0.82, sourceName: fairfaxName, sourceUrl: sources.fairfaxFishing, summary: "Fairfax County specifically says Riverbend's Potomac reach holds channel catfish." }),
];

const accotinkEvidence = [
  officialEvidence({ speciesId: "bluegill", availability: 0.48, quality: 0.34, confidence: 0.72, sourceName: fairfaxName, sourceUrl: sources.fairfaxFishing, summary: "Fairfax County says Lake Accotink's limited fishing generally centers on bluegill.", limits: ["The agency describes the shallow, silted lake as generally poor fishing water"] }),
];

const fountainheadEvidence = [
  officialEvidence({ speciesId: "bluegill", availability: 0.74, quality: 0.57, sourceName: novaName, sourceUrl: sources.novaFountainhead, summary: "NOVA Parks specifically lists bluegill in the Occoquan Reservoir at Fountainhead." }),
];

const pohickEvidence = [
  officialEvidence({ speciesId: "largemouth-bass", availability: 0.75, quality: 0.59, sourceName: novaName, sourceUrl: sources.novaPohick, summary: "NOVA Parks specifically lists largemouth bass at Pohick Bay." }),
  officialEvidence({ speciesId: "bluegill", availability: 0.78, sourceName: novaName, sourceUrl: sources.novaPohick, summary: "NOVA Parks specifically lists bluegill at Pohick Bay." }),
  officialEvidence({ speciesId: "common-carp", availability: 0.69, sourceName: novaName, sourceUrl: sources.novaPohick, summary: "NOVA Parks lists carp at Pohick Bay; BiteMap maps that broad listing to common carp." }),
  officialEvidence({ speciesId: "striped-bass", availability: 0.58, quality: 0.5, sourceName: novaName, sourceUrl: sources.novaPohick, summary: "NOVA Parks lists striped bass at Pohick Bay and notes a fall peak." }),
];

const occoquanEvidence = [
  officialEvidence({ speciesId: "largemouth-bass", availability: 0.76, quality: 0.6, sourceName: novaName, sourceUrl: sources.novaOccoquan, summary: "NOVA Parks specifically lists largemouth bass in the Occoquan River at the regional park." }),
  officialEvidence({ speciesId: "white-perch", availability: 0.72, sourceName: novaName, sourceUrl: sources.novaOccoquan, summary: "NOVA Parks specifically lists white perch at Occoquan Regional Park." }),
  officialEvidence({ speciesId: "striped-bass", availability: 0.62, sourceName: novaName, sourceUrl: sources.novaOccoquan, summary: "NOVA Parks specifically lists striped bass at Occoquan Regional Park." }),
  officialEvidence({ speciesId: "yellow-perch", availability: 0.66, sourceName: novaName, sourceUrl: sources.novaOccoquan, summary: "NOVA Parks specifically lists yellow perch at Occoquan Regional Park." }),
  officialEvidence({ speciesId: "flathead-catfish", availability: 0.64, sourceName: novaName, sourceUrl: sources.novaOccoquan, summary: "NOVA Parks specifically lists flathead catfish at Occoquan Regional Park." }),
  officialEvidence({ speciesId: "channel-catfish", availability: 0.72, sourceName: novaName, sourceUrl: sources.novaOccoquan, summary: "NOVA Parks specifically lists channel catfish at Occoquan Regional Park." }),
];

const reservoirEvidence = [
  officialEvidence({ speciesId: "largemouth-bass", availability: 0.77, quality: 0.6, sourceName: novaName, sourceUrl: sources.novaReservoir, summary: "NOVA Parks specifically lists largemouth bass at Beaverdam Reservoir." }),
  officialEvidence({ speciesId: "common-carp", availability: 0.68, sourceName: novaName, sourceUrl: sources.novaReservoir, summary: "NOVA Parks lists carp at Beaverdam Reservoir; BiteMap maps that broad listing to common carp." }),
];

const pwcLakeEvidence = [
  officialEvidence({ speciesId: "largemouth-bass", availability: 0.74, sourceName: pwcName, sourceUrl: sources.pwcFishing, summary: "Prince William County lists largemouth bass among the abundant fish at its primary fishing parks.", limits: ["The county page reports the park group rather than a site-specific population survey"] }),
  officialEvidence({ speciesId: "channel-catfish", availability: 0.74, sourceName: pwcName, sourceUrl: sources.pwcFishing, summary: "Prince William County lists channel catfish among the abundant fish at its primary fishing parks.", limits: ["The county page reports the park group rather than a site-specific population survey"] }),
  officialEvidence({ speciesId: "bluegill", availability: 0.79, sourceName: pwcName, sourceUrl: sources.pwcFishing, summary: "Prince William County lists bluegill among the abundant fish at its primary fishing parks.", limits: ["The county page reports the park group rather than a site-specific population survey"] }),
];

const dcrLargemouthEvidence = (park: string, sourceUrl: string) => [
  officialEvidence({ speciesId: "largemouth-bass", availability: 0.7, quality: 0.55, sourceName: "Virginia State Parks", sourceUrl, summary: `Virginia State Parks identifies good largemouth bass fishing on the freshwater Potomac at ${park}.`, limits: ["The state overview does not provide a current park-specific survey"] }),
];

type CoverageSeed = {
  id: string;
  name: string;
  waterbody: string;
  waterbodyType: FishingLocationSeed["waterbodyType"];
  county: string;
  lat: number;
  lng: number;
  distanceMiles: number;
  travelMinutes: number;
  access: AccessMethod[];
  aliases?: string[];
  accessAuthority: string;
  accessSourceUrl: string;
  notice?: string;
  evidence?: SpeciesEvidence[];
  accessFit?: number;
  accessConditions?: AccessCondition[];
  accessStatus?: FishingLocationSeed["accessStatus"];
};

const verifiedLocation = (seed: CoverageSeed): FishingLocationSeed => ({
  id: seed.id,
  name: seed.name,
  waterbody: seed.waterbody,
  waterbodyType: seed.waterbodyType,
  county: seed.county,
  lat: seed.lat,
  lng: seed.lng,
  distanceMiles: seed.distanceMiles,
  travelMinutes: seed.travelMinutes,
  publicAccess: true,
  access: seed.access,
  aliases: seed.aliases ?? [],
  notice: seed.notice ?? `${seed.accessAuthority} identifies this as a fishing location. Verify current hours, closures, license rules, and posted boundaries before departure.`,
  flowStatus: seed.waterbodyType === "river" ? "Representative gage not yet verified" : "Live water data unavailable",
  activityEstimate: 0.5,
  accessFit: seed.accessFit ?? 0.84,
  bestWindow: "Unavailable",
  evidence: seed.evidence ?? [],
  accessAuthority: seed.accessAuthority,
  accessSourceUrl: seed.accessSourceUrl,
  sourceReviewed: sourceReviewDate,
  accessConditions: seed.accessConditions,
  accessStatus: seed.accessStatus ?? "verified",
});

const quanticoCredentials: AccessCondition[] = [
  {
    kind: "credential",
    label: "Base credentials required",
    detail: "Public anglers need current MCB Quantico access credentials, including DBIDS, before entering the installation.",
  },
  {
    kind: "permit",
    label: "iSportsman registration required",
    detail: "Complete the current Quantico iSportsman registration, check-in, and permit process before fishing.",
  },
];

const wmaAccessPermit: AccessCondition[] = [
  {
    kind: "permit",
    label: "WMA access requirement",
    detail: "Carry a qualifying Virginia license or registration, or the current DWR WMA access permit.",
  },
];

export const coverageLocations: FishingLocationSeed[] = [
  verifiedLocation({ id: "lake-fairfax", name: "Lake Fairfax Park", waterbody: "Lake Fairfax", waterbodyType: "lake", county: "Fairfax", lat: 38.961164, lng: -77.318652, distanceMiles: 12, travelMinutes: 24, access: ["shore", "kayak"], aliases: ["Lake Fairfax"], accessAuthority: fairfaxName, accessSourceUrl: sources.fairfaxFishing, evidence: lakeFairfaxEvidence }),
  verifiedLocation({ id: "riverbend-park", name: "Riverbend Park", waterbody: "Potomac River", waterbodyType: "river", county: "Fairfax", lat: 39.019261, lng: -77.250371, distanceMiles: 18, travelMinutes: 31, access: ["shore", "kayak", "boat"], accessAuthority: fairfaxName, accessSourceUrl: sources.fairfaxFishing, evidence: riverbendEvidence, notice: "Riverbend verifies shore and small-craft fishing. Check river conditions and park restrictions; do not treat a fishing listing as permission to wade." }),
  verifiedLocation({ id: "lake-accotink", name: "Lake Accotink Park", waterbody: "Lake Accotink", waterbodyType: "lake", county: "Fairfax", lat: 38.801697, lng: -77.228921, distanceMiles: 9, travelMinutes: 20, access: ["shore", "kayak"], aliases: ["Accotink"], accessAuthority: fairfaxName, accessSourceUrl: sources.fairfaxFishing, evidence: accotinkEvidence, notice: "Fairfax County describes Lake Accotink as shallow and generally poor fishing water. Verify current launch rules and expectations before departure." }),
  verifiedLocation({ id: "huntsman-lake", name: "Huntsman Lake", waterbody: "Huntsman Lake", waterbodyType: "lake", county: "Fairfax", lat: 38.755066, lng: -77.259976, distanceMiles: 12, travelMinutes: 22, access: ["shore", "kayak"], accessAuthority: fairfaxName, accessSourceUrl: sources.fairfaxSmallLakes, notice: "Carry-in craft only; parking and shoreline access are limited. Species evidence is still pending the BiteMap gate." }),
  verifiedLocation({ id: "royal-lake", name: "Royal Lake Park", waterbody: "Royal Lake", waterbodyType: "lake", county: "Fairfax", lat: 38.802731, lng: -77.288804, distanceMiles: 8, travelMinutes: 18, access: ["shore"], aliases: ["Lake Royal", "Lakeside Park"], accessAuthority: fairfaxName, accessSourceUrl: sources.fairfaxSmallLakes }),
  verifiedLocation({ id: "walney-pond", name: "Walney Pond", waterbody: "Walney Pond", waterbodyType: "pond", county: "Fairfax", lat: 38.85373, lng: -77.43064, distanceMiles: 9, travelMinutes: 19, access: ["shore"], aliases: ["Ellanor C. Lawrence Park", "ECLP"], accessAuthority: fairfaxName, accessSourceUrl: sources.fairfaxFishing }),
  verifiedLocation({ id: "hidden-pond", name: "Hidden Pond Nature Center", waterbody: "Hidden Pond", waterbodyType: "pond", county: "Fairfax", lat: 38.772286, lng: -77.23874, distanceMiles: 11, travelMinutes: 21, access: ["shore"], accessAuthority: fairfaxName, accessSourceUrl: sources.fairfaxFishing, notice: "Fairfax County says fishing success is poor and fishing is mostly conducted through park programs. Confirm permission before planning an independent outing." }),
  verifiedLocation({ id: "lake-mercer", name: "Lake Mercer", waterbody: "Lake Mercer", waterbodyType: "lake", county: "Fairfax", lat: 38.739847, lng: -77.257314, distanceMiles: 15, travelMinutes: 25, access: ["shore", "kayak"], aliases: ["Recreation Lake Park"], accessAuthority: fairfaxName, accessSourceUrl: sources.fairfaxSmallLakes, notice: "Fishing and carry-in small craft are allowed, but the lake requires a walk from parking and summer shoreline access can be limited." }),
  verifiedLocation({ id: "woodglen-lake", name: "Woodglen Lake Park", waterbody: "Woodglen Lake", waterbodyType: "lake", county: "Fairfax", lat: 38.806485, lng: -77.314842, distanceMiles: 7, travelMinutes: 16, access: ["shore", "kayak"], aliases: ["Woodglen Lake"], accessAuthority: fairfaxName, accessSourceUrl: sources.fairfaxSmallLakes, notice: "Stay on public land near the shoreline. Parking is limited and boats must be carried in; motors are prohibited." }),

  verifiedLocation({ id: "vernon-view", name: "Vernon View Drive", waterbody: "Potomac River", waterbodyType: "river", county: "Fairfax", lat: 38.718131, lng: -77.062311, distanceMiles: 25, travelMinutes: 37, access: ["shore"], accessAuthority: "National Park Service", accessSourceUrl: sources.npsGwmp, notice: "NPS lists Vernon View Drive for fishing. Swimming and wading are prohibited in the Potomac; confirm the correct license and current park rules." }),
  verifiedLocation({ id: "riverside-park-potomac", name: "Riverside Park", waterbody: "Potomac River", waterbodyType: "river", county: "Fairfax", lat: 38.711382, lng: -77.072716, distanceMiles: 25, travelMinutes: 38, access: ["shore"], aliases: ["Riverside Park Fort Hunt"], accessAuthority: "National Park Service", accessSourceUrl: sources.npsGwmp, notice: "NPS lists Riverside Park for fishing. Swimming and wading are prohibited in the Potomac; confirm the correct license and current park rules." }),
  verifiedLocation({ id: "dyke-marsh", name: "Dyke Marsh", waterbody: "Potomac River", waterbodyType: "river", county: "Fairfax", lat: 38.762879, lng: -77.04679, distanceMiles: 24, travelMinutes: 36, access: ["shore", "kayak", "boat"], aliases: ["Dyke Marsh Wildlife Preserve"], accessAuthority: "National Park Service", accessSourceUrl: sources.npsGwmp, notice: "NPS lists Dyke Marsh for fishing and requires different licenses for land and boat fishing. Swimming and wading are prohibited." }),
  verifiedLocation({ id: "belle-haven", name: "Belle Haven", waterbody: "Potomac River", waterbodyType: "river", county: "Fairfax", lat: 38.777578, lng: -77.049072, distanceMiles: 23, travelMinutes: 34, access: ["shore", "kayak", "boat"], aliases: ["Belle Haven Marina"], accessAuthority: "National Park Service", accessSourceUrl: sources.npsGwmp, notice: "NPS lists Belle Haven for fishing. Swimming and wading are prohibited in the Potomac; verify marina and license rules." }),
  verifiedLocation({ id: "jones-point", name: "Jones Point Park", waterbody: "Potomac River", waterbodyType: "river", county: "Alexandria", lat: 38.793261, lng: -77.042644, distanceMiles: 22, travelMinutes: 32, access: ["shore"], aliases: ["Jones Point"], accessAuthority: "National Park Service", accessSourceUrl: sources.npsGwmp, notice: "License requirements differ under and around the Woodrow Wilson Bridge. NPS prohibits swimming and wading in the Potomac." }),
  verifiedLocation({ id: "daingerfield-island", name: "Daingerfield Island", waterbody: "Potomac River", waterbodyType: "river", county: "Alexandria", lat: 38.831183, lng: -77.041242, distanceMiles: 20, travelMinutes: 29, access: ["shore"], accessAuthority: "National Park Service", accessSourceUrl: sources.npsGwmp, notice: "NPS lists Daingerfield Island for fishing and says a Washington, DC fishing license is required. Swimming and wading are prohibited." }),
  verifiedLocation({ id: "roaches-run", name: "Roaches Run", waterbody: "Roaches Run Waterfowl Sanctuary", waterbodyType: "bay", county: "Arlington", lat: 38.864588, lng: -77.04444, distanceMiles: 19, travelMinutes: 28, access: ["shore"], aliases: ["Roaches Run Waterfowl Sanctuary"], accessAuthority: "National Park Service", accessSourceUrl: sources.npsGwmp, notice: "NPS lists Roaches Run for fishing and says a Virginia license is required. Respect sanctuary boundaries and posted restrictions." }),
  verifiedLocation({ id: "gravelly-point", name: "Gravelly Point", waterbody: "Potomac River", waterbodyType: "river", county: "Arlington", lat: 38.865037, lng: -77.039513, distanceMiles: 19, travelMinutes: 28, access: ["shore"], accessAuthority: "National Park Service", accessSourceUrl: sources.npsGwmp, notice: "NPS lists Gravelly Point for fishing and says a Washington, DC license is required. Swimming and wading are prohibited." }),
  verifiedLocation({ id: "theodore-roosevelt-island", name: "Theodore Roosevelt Island", waterbody: "Potomac River", waterbodyType: "river", county: "Arlington", lat: 38.89541, lng: -77.062202, distanceMiles: 18, travelMinutes: 27, access: ["shore"], aliases: ["TR Island"], accessAuthority: "National Park Service", accessSourceUrl: sources.npsGwmp, notice: "NPS lists Theodore Roosevelt Island for fishing and says a Washington, DC license is required. Swimming and wading are prohibited." }),

  verifiedLocation({ id: "fountainhead", name: "Fountainhead Regional Park", waterbody: "Occoquan Reservoir", waterbodyType: "reservoir", county: "Fairfax", lat: 38.723588, lng: -77.326156, distanceMiles: 17, travelMinutes: 28, access: ["shore", "kayak", "boat"], accessAuthority: novaName, accessSourceUrl: sources.novaFountainhead, evidence: fountainheadEvidence }),
  verifiedLocation({ id: "bull-run-marina", name: "Bull Run Marina", waterbody: "Occoquan Reservoir", waterbodyType: "reservoir", county: "Fairfax", lat: 38.742443, lng: -77.387518, distanceMiles: 18, travelMinutes: 29, access: ["shore", "kayak", "boat"], accessAuthority: novaName, accessSourceUrl: sources.novaBullRun, notice: "Shore fishing is free, but boat launching requires the current gate-key or pass process. All patrons must leave by dark." }),
  verifiedLocation({ id: "pohick-bay", name: "Pohick Bay Regional Park", waterbody: "Pohick Bay", waterbodyType: "bay", county: "Fairfax", lat: 38.678859, lng: -77.190496, distanceMiles: 24, travelMinutes: 36, access: ["shore", "kayak", "boat"], accessAuthority: novaName, accessSourceUrl: sources.novaPohick, evidence: pohickEvidence }),
  verifiedLocation({ id: "algonkian", name: "Algonkian Regional Park", waterbody: "Potomac River", waterbodyType: "river", county: "Loudoun", lat: 39.05802, lng: -77.380188, distanceMiles: 22, travelMinutes: 34, access: ["shore", "kayak", "boat"], accessAuthority: novaName, accessSourceUrl: sources.novaAlgonkian, notice: "NOVA Parks warns that Potomac levels fluctuate and the river contains underwater obstructions and swift currents. Swimming and wading are prohibited." }),
  verifiedLocation({ id: "piscataway-crossing", name: "Piscataway Crossing Regional Park", waterbody: "Potomac River", waterbodyType: "river", county: "Loudoun", lat: 39.197251, lng: -77.484365, distanceMiles: 34, travelMinutes: 47, access: ["shore", "kayak"], aliases: ["White's Ford", "Whites Ford"], accessAuthority: novaName, accessSourceUrl: sources.novaPiscataway, notice: "Fishing is limited to designated areas. Only non-motorized, car-top boats are allowed; no trailers or motorboats." }),
  verifiedLocation({ id: "seneca-regional", name: "Seneca Regional Park", waterbody: "Potomac River", waterbodyType: "river", county: "Fairfax", lat: 39.052593, lng: -77.324984, distanceMiles: 20, travelMinutes: 32, access: ["shore"], accessAuthority: novaName, accessSourceUrl: sources.novaSeneca, notice: "The fishing area requires a trail approach to rapids and deeper pools. Verify river conditions and stay out of unsafe water." }),
  verifiedLocation({ id: "occoquan-regional", name: "Occoquan Regional Park", waterbody: "Occoquan River", waterbodyType: "river", county: "Fairfax", lat: 38.684466, lng: -77.24159, distanceMiles: 22, travelMinutes: 32, access: ["shore", "kayak", "boat"], accessAuthority: novaName, accessSourceUrl: sources.novaOccoquan, evidence: occoquanEvidence }),
  verifiedLocation({ id: "beaverdam-reservoir", name: "Beaverdam Reservoir", waterbody: "Beaverdam Reservoir", waterbodyType: "reservoir", county: "Loudoun", lat: 39.002427, lng: -77.536149, distanceMiles: 22, travelMinutes: 32, access: ["shore", "kayak", "boat"], aliases: ["Reservoir Park", "Beaverdam Reservoir Park"], accessAuthority: novaName, accessSourceUrl: sources.novaReservoir, evidence: reservoirEvidence, notice: "Fishing is allowed only in designated shoreline and water areas. Gas motors, swimming, and wading are prohibited; observe the dam restriction zone." }),
  verifiedLocation({ id: "bull-run-regional-park", name: "Bull Run Regional Park", waterbody: "Bull Run", waterbodyType: "stream", county: "Fairfax", lat: 38.7936, lng: -77.4597, distanceMiles: 20, travelMinutes: 30, access: ["shore", "wade"], aliases: ["Bull Run", "Bull Run stream", "Hemlock Overlook", "Bull Run-Occoquan Trail"], accessAuthority: novaName, accessSourceUrl: sources.novaBullRunPark, notice: "Bull Run is a wadeable smallmouth stream on public NOVA Parks land (Bull Run Regional Park and the Bull Run-Occoquan Trail). A Virginia freshwater license is required; check flow before wading and mind posted private-land boundaries along the corridor." }),
  verifiedLocation({ id: "lake-cook", name: "Lake Cook", waterbody: "Lake Cook", waterbodyType: "lake", county: "Alexandria", lat: 38.8339, lng: -77.0533, distanceMiles: 8, travelMinutes: 18, access: ["shore"], accessAuthority: "City of Alexandria", accessSourceUrl: sources.alexandriaLakeCook, notice: "A small City of Alexandria stormwater lake open to shoreline fishing. No exact fishery survey is on file yet; check city rules and any seasonal stocking notices." }),
  verifiedLocation({ id: "ashby-pond", name: "Ashby Pond Conservatory", waterbody: "Ashby Pond", waterbodyType: "pond", county: "Fairfax City", lat: 38.84874, lng: -77.28447, access: ["shore"], distanceMiles: 12, travelMinutes: 22, accessAuthority: "City of Fairfax", accessSourceUrl: sources.fairfaxCityParks, notice: "A small City of Fairfax conservatory pond. No exact fishery survey is on file; likely a light panfish/bass pond. Verify current rules on-site." }),
  verifiedLocation({ id: "long-branch-arlington", name: "Long Branch (Glencarlyn Park)", waterbody: "Long Branch", waterbodyType: "stream", county: "Arlington", lat: 38.8558, lng: -77.1053, access: ["shore", "wade"], distanceMiles: 7, travelMinutes: 16, aliases: ["Long Branch Nature Center", "Long Branch Creek"], accessAuthority: "Arlington County", accessSourceUrl: sources.arlingtonStreams, notice: "A small urban stream through Glencarlyn Park and the Long Branch Nature Center. Wadeable panfish water; a Virginia freshwater license is required." }),
  verifiedLocation({ id: "meadowood-ponds", name: "Meadowood SRMA Ponds", waterbody: "Meadowood Ponds", waterbodyType: "pond", county: "Fairfax", lat: 38.665, lng: -77.22, access: ["shore"], distanceMiles: 22, travelMinutes: 32, aliases: ["Hidden Pond Meadowood", "Enchanted Pond", "Meadowood Recreation Area"], accessAuthority: "Bureau of Land Management", accessSourceUrl: sources.blmMeadowood, notice: "Small ponds at the BLM Meadowood Special Recreation Management Area (Mason Neck / Lorton). No exact fishery survey is on file; typically light largemouth/panfish ponds. Check BLM rules on-site." }),

  verifiedLocation({ id: "leesylvania", name: "Leesylvania State Park", waterbody: "Potomac River", waterbodyType: "river", county: "Prince William", lat: 38.59083, lng: -77.253208, distanceMiles: 31, travelMinutes: 43, access: ["shore", "kayak", "boat"], accessAuthority: "Virginia State Parks", accessSourceUrl: sources.dcrLeesylvania, evidence: dcrLargemouthEvidence("Leesylvania", sources.dcrFishing) }),
  verifiedLocation({ id: "mason-neck", name: "Mason Neck State Park", waterbody: "Belmont Bay", waterbodyType: "bay", county: "Fairfax", lat: 38.64852, lng: -77.181379, distanceMiles: 27, travelMinutes: 39, access: ["kayak", "boat"], accessAuthority: "Virginia State Parks", accessSourceUrl: sources.dcrMasonNeck, evidence: dcrLargemouthEvidence("Mason Neck", sources.dcrFishing), notice: "Mason Neck allows fishing from car-top craft on Belmont Bay; fishing from park trails is not permitted. Fresh and brackish licenses differ." }),

  verifiedLocation({ id: "lake-ridge-marina", name: "Lake Ridge Golf & Marina", waterbody: "Occoquan Reservoir", waterbodyType: "reservoir", county: "Prince William", lat: 38.691157, lng: -77.318267, distanceMiles: 21, travelMinutes: 31, access: ["shore", "kayak", "boat"], aliases: ["Lake Ridge Park Marina"], accessAuthority: pwcName, accessSourceUrl: sources.pwcFishing, evidence: pwcLakeEvidence, notice: "Prince William County lists a concrete ramp and a 10-horsepower limit. Verify current rental and operating hours." }),
  verifiedLocation({ id: "locust-shade", name: "Locust Shade Park", waterbody: "Locust Shade Pond", waterbodyType: "pond", county: "Prince William", lat: 38.531039, lng: -77.35487, distanceMiles: 35, travelMinutes: 46, access: ["shore", "boat"], accessAuthority: pwcName, accessSourceUrl: sources.pwcFishing, evidence: pwcLakeEvidence }),
  verifiedLocation({ id: "silver-lake", name: "Silver Lake Regional Park", waterbody: "Silver Lake", waterbodyType: "lake", county: "Prince William", lat: 38.842712, lng: -77.664715, distanceMiles: 27, travelMinutes: 40, access: ["shore", "kayak", "boat"], accessAuthority: pwcName, accessSourceUrl: sources.pwcFishing, evidence: pwcLakeEvidence, notice: "The county permits personally owned non-motorized boats and does not provide rentals at this park." }),
  verifiedLocation({ id: "marumsco-acre-lake", name: "Marumsco Acre Lake Park", waterbody: "Marumsco Acre Lake", waterbodyType: "lake", county: "Prince William", lat: 38.640112, lng: -77.252509, distanceMiles: 27, travelMinutes: 38, access: ["shore"], accessAuthority: pwcName, accessSourceUrl: sources.pwcFishing }),
  verifiedLocation({ id: "occoquan-hand-carry", name: "Occoquan Hand Carry Launch", waterbody: "Occoquan River", waterbodyType: "river", county: "Prince William", lat: 38.706036, lng: -77.44777, distanceMiles: 20, travelMinutes: 31, access: ["shore", "kayak"], aliases: ["Hinson Mill Lane"], accessAuthority: pwcName, accessSourceUrl: sources.pwcFishing, notice: "The launch requires carrying a boat about 400 feet down a trail. The return is upstream and uphill; plan a downstream takeout when appropriate." }),

  verifiedLocation({ id: "great-falls", name: "Great Falls Park", waterbody: "Potomac River", waterbodyType: "river", county: "Fairfax", lat: 38.990455, lng: -77.251843, distanceMiles: 17, travelMinutes: 29, access: ["shore"], aliases: ["Fisherman's Eddy", "Fishermans Eddy"], accessAuthority: "National Park Service", accessSourceUrl: sources.npsGreatFalls, notice: "NPS permits fishing with a Virginia or Maryland license. Keep away from cliffs, falls, and restricted water; fishing access does not imply permission to wade." }),

  // --- Coverage sweep batch 2 (outer counties: Loudoun / PWC / Manassas) ---
  verifiedLocation({ id: "goose-creek", name: "Keep Loudoun Beautiful Park (Goose Creek)", waterbody: "Goose Creek", waterbodyType: "stream", county: "Loudoun", lat: 39.0865441, lng: -77.5137493, distanceMiles: 33, travelMinutes: 54, access: ["shore"], accessAuthority: "Loudoun County Parks, Recreation & Community Services", accessSourceUrl: "https://www.loudoun.gov/facilities/facility/details/Keep-Loudoun-Beautiful-Park-34", notice: "The county identifies fishing access at the park. BiteMap has not verified permission to enter or wade Goose Creek; fish from legal public shoreline and follow posted rules." }),
  verifiedLocation({ id: "broad-run-bles", name: "Bles Park (Broad Run)", waterbody: "Broad Run", waterbodyType: "stream", county: "Loudoun", lat: 39.0665, lng: -77.4439, distanceMiles: 29, travelMinutes: 46, access: ["shore"], accessAuthority: "Loudoun County Parks, Recreation & Community Services", accessSourceUrl: "https://www.loudoun.gov/facilities/facility/details/22", notice: "The county park page establishes public park access but does not establish permission to enter or wade Broad Run. Stay on legal public shoreline and follow posted rules." }),
  verifiedLocation({ id: "cedar-run-merrimac", name: "Cedar Run at Merrimac Farm WMA", waterbody: "Cedar Run", waterbodyType: "stream", county: "Prince William", lat: 38.6154, lng: -77.5529, distanceMiles: 39, travelMinutes: 62, access: ["shore", "wade"], accessAuthority: "Virginia Department of Wildlife Resources", accessSourceUrl: "https://dwr.virginia.gov/wma/merrimac-farm/", accessConditions: wmaAccessPermit }),
  verifiedLocation({ id: "chopawamsic-trout", name: "Chopawamsic Creek Trout Waters (MCB Quantico)", waterbody: "Chopawamsic Creek", waterbodyType: "stream", county: "Prince William", lat: 38.52282, lng: -77.37239, distanceMiles: 36, travelMinutes: 58, access: ["shore", "wade"], accessAuthority: "U.S. Marine Corps / Virginia DWR", accessSourceUrl: "https://quantico.isportsman.net/choptrout.aspx", notice: "Public fishing requires MCB Quantico base credentials (DBIDS card + iSportsman registration). Trout are seasonally stocked (put-and-take).", accessConditions: quanticoCredentials }),
  verifiedLocation({ id: "grays-reservoir", name: "Gray's Reservoir (MCB Quantico)", waterbody: "Gray's Reservoir", waterbodyType: "reservoir", county: "Prince William", lat: 38.52732, lng: -77.38254, distanceMiles: 36, travelMinutes: 58, access: ["shore", "kayak"], accessAuthority: "U.S. Marine Corps / Virginia DWR", accessSourceUrl: "https://quantico.isportsman.net/choptrout.aspx", notice: "Public fishing requires MCB Quantico base credentials (DBIDS card + iSportsman registration). Rainbow trout seasonally stocked (put-and-take).", accessConditions: [...quanticoCredentials, { kind: "vessel", label: "Check reservoir vessel rules", detail: "Confirm current launch, watercraft, and motor restrictions in iSportsman before bringing a boat." }] }),
  verifiedLocation({ id: "secon-pool", name: "Secon Pool Youth Trout Water (MCB Quantico)", waterbody: "Secon Pool", waterbodyType: "stream", county: "Prince William", lat: 38.553776, lng: -77.432404, distanceMiles: 36, travelMinutes: 58, access: ["shore", "wade"], accessAuthority: "U.S. Marine Corps / Virginia DWR", accessSourceUrl: "https://quantico.isportsman.net/secon.aspx", notice: "Youth-only (age 12 and under). Public fishing requires MCB Quantico base credentials (DBIDS + iSportsman). Trout seasonally stocked.", accessConditions: [...quanticoCredentials, { kind: "age", label: "Youth-only water", detail: "Fishing is restricted to children age 12 and under under the current Quantico rule." }] }),
  verifiedLocation({ id: "sleeter-lake", name: "Sleeter Lake Park", waterbody: "Sleeter Lake", waterbodyType: "lake", county: "Loudoun", lat: 39.1239446, lng: -77.7619292, distanceMiles: 50, travelMinutes: 79, access: ["shore", "kayak"], accessAuthority: "Town of Round Hill", accessSourceUrl: "https://dwr.virginia.gov/waterbody/sleeter-lake/", notice: "Catch-and-release only; electric-motor or paddle craft only (no gas motors, no boat ramp); seasonal (~Mar–Nov).", accessConditions: [{ kind: "harvest", label: "Catch-and-release only", detail: "All fish must be released under the current lake rules." }, { kind: "vessel", label: "No gas motors", detail: "Use paddle craft or an electric motor; there is no boat ramp." }, { kind: "seasonal", label: "Seasonal access", detail: "The published operating season is approximately March through November; confirm current dates." }] }),
  verifiedLocation({ id: "claude-moore-ponds", name: "Claude Moore Park Fishing Ponds", waterbody: "Claude Moore Park Ponds", waterbodyType: "pond", county: "Loudoun", lat: 39.0169, lng: -77.4061, distanceMiles: 24, travelMinutes: 39, access: ["shore"], accessAuthority: "Loudoun County Parks, Recreation & Community Services", accessSourceUrl: "https://www.loudoun.gov/1288/Sportsplex-Nature-Area" }),
  verifiedLocation({ id: "breckenridge-reservoir", name: "Breckenridge Reservoir (MCB Quantico)", waterbody: "Breckenridge Reservoir", waterbodyType: "reservoir", county: "Prince William", lat: 38.5424, lng: -77.39655, distanceMiles: 36, travelMinutes: 57, access: ["shore", "kayak"], accessAuthority: "U.S. Marine Corps / Virginia DWR", accessSourceUrl: "https://quantico.isportsman.net/Breckenridge.aspx", notice: "Public fishing requires MCB Quantico base credentials (DBIDS card + iSportsman registration); electric motors only.", accessConditions: [...quanticoCredentials, { kind: "vessel", label: "Electric motors only", detail: "Gas motors are not permitted under the current reservoir rules." }] }),
  verifiedLocation({ id: "lunga-reservoir", name: "Lunga Reservoir (MCB Quantico)", waterbody: "Lunga Reservoir", waterbodyType: "reservoir", county: "Prince William", lat: 38.53239, lng: -77.46345, distanceMiles: 39, travelMinutes: 63, access: ["shore", "kayak"], accessAuthority: "U.S. Marine Corps / Virginia DWR", accessSourceUrl: "https://quantico.isportsman.net/Lunga%20Reservoir.aspx", notice: "Public fishing requires MCB Quantico base credentials (DBIDS card + iSportsman registration); electric motors only.", accessConditions: [...quanticoCredentials, { kind: "vessel", label: "Electric motors only", detail: "Gas motors are not permitted under the current reservoir rules." }] }),
  verifiedLocation({ id: "franklin-park-pond", name: "Franklin Park Fishing Pond", waterbody: "Franklin Park Pond", waterbodyType: "pond", county: "Loudoun", lat: 39.1304, lng: -77.7421, distanceMiles: 49, travelMinutes: 78, access: ["shore"], accessAuthority: "Loudoun County Parks, Recreation & Community Services", accessSourceUrl: "https://www.loudoun.gov/facilities/facility/details/Franklin-Park-47" }),
  verifiedLocation({ id: "springhouse-pond", name: "Springhouse Pond (Banshee Reeks Nature Preserve)", waterbody: "Springhouse Pond", waterbodyType: "pond", county: "Loudoun", lat: 39.0266454, lng: -77.6009996, distanceMiles: 36, travelMinutes: 58, access: ["shore"], accessAuthority: "Loudoun County Parks, Recreation & Community Services", accessSourceUrl: "https://www.loudoun.gov/facilities/facility/details/Banshee-Reeks-Nature-Preserve-43" }),
  verifiedLocation({ id: "meadow-glen-pond", name: "Meadow Glen Park Fishing Pond", waterbody: "Meadow Glen Pond", waterbodyType: "pond", county: "Loudoun", lat: 38.928801, lng: -77.565177, distanceMiles: 32, travelMinutes: 51, access: ["shore"], accessAuthority: "Loudoun County Parks, Recreation & Community Services", accessSourceUrl: "https://www.loudoun.gov/Facilities/Facility/Details/Meadow-Glen-Park-89" }),
  verifiedLocation({ id: "mickie-gordon-pond", name: "Mickie Gordon Memorial Park Fishing Pond", waterbody: "Mickie Gordon Pond", waterbodyType: "pond", county: "Loudoun", lat: 38.97613, lng: -77.70265, distanceMiles: 42, travelMinutes: 67, access: ["shore"], accessAuthority: "Loudoun County Parks, Recreation & Community Services", accessSourceUrl: "https://www.loudoun.gov/facilities/facility/details/Mickie-Gordon-Memorial-Park-40" }),
  verifiedLocation({ id: "lovettsville-pond", name: "Lovettsville Community Park Fishing Pond", waterbody: "Lovettsville Community Pond", waterbodyType: "pond", county: "Loudoun", lat: 39.265855, lng: -77.635802, distanceMiles: 49, travelMinutes: 79, access: ["shore"], accessAuthority: "Loudoun County Parks, Recreation & Community Services", accessSourceUrl: "https://www.loudoun.gov/Facilities/Facility/Details/Lovettsville-Community-Park-36", accessConditions: [{ kind: "license", label: "License required for age 16+", detail: "Anglers age 16 and older need a valid Virginia freshwater fishing license." }, { kind: "vessel", label: "Shore fishing only", detail: "Boats and wading are not permitted at the community pond." }] }),
  verifiedLocation({ id: "hanson-pond", name: "Hal & Berni Hanson Regional Park Fishing Pond", waterbody: "Hanson Regional Park Pond", waterbodyType: "pond", county: "Loudoun", lat: 38.97117, lng: -77.54742, distanceMiles: 32, travelMinutes: 51, access: ["shore"], accessAuthority: "Loudoun County Parks, Recreation & Community Services", accessSourceUrl: "https://www.loudoun.gov/facilities/facility/details/Hal-Berni-Hanson-Regional-Park-186", accessConditions: [{ kind: "harvest", label: "Catch-and-release only", detail: "The county's fishing guide identifies the park fishing ponds as catch-and-release." }] }),
  verifiedLocation({ id: "izaak-walton-pond", name: "Olde Izaak Walton Park Pond", waterbody: "Olde Izaak Walton Pond", waterbodyType: "pond", county: "Loudoun", lat: 39.1021, lng: -77.5664, distanceMiles: 37, travelMinutes: 59, access: ["shore"], accessAuthority: "Town of Leesburg", accessSourceUrl: "https://www.leesburgva.gov/Home/Components/FacilityDirectory/FacilityDirectory/42/5725" }),
  verifiedLocation({ id: "cannon-branch-pond", name: "Cannon Branch Fort Fishing Pond", waterbody: "Cannon Branch Fort Pond", waterbodyType: "pond", county: "Manassas", lat: 38.73768, lng: -77.5155, distanceMiles: 31, travelMinutes: 50, access: ["shore"], accessAuthority: "City of Manassas", accessSourceUrl: "https://www.manassasva.gov/news_detail_T11_R293.php" }),
  verifiedLocation({ id: "carters-pond-pwfp", name: "Carter's Pond (Prince William Forest Park)", waterbody: "Carter's Pond", waterbodyType: "pond", county: "Prince William", lat: 38.5635977, lng: -77.3669338, distanceMiles: 33, travelMinutes: 53, access: ["shore"], accessAuthority: "National Park Service", accessSourceUrl: "https://www.nps.gov/places/000/carters-pond-wildlife-viewing-trail.htm", accessConditions: [{ kind: "harvest", label: "Catch-and-release only", detail: "National Park Service rules require fish caught at Carter's Pond to be released." }] }),
  verifiedLocation({ id: "merrimac-farm-pond", name: "Merrimac Farm WMA Pond", waterbody: "Merrimac Farm Pond", waterbodyType: "pond", county: "Prince William", lat: 38.62819, lng: -77.54072, distanceMiles: 37, travelMinutes: 60, access: ["shore"], accessAuthority: "Virginia Department of Wildlife Resources", accessSourceUrl: "https://dwr.virginia.gov/wma/merrimac-farm/", accessConditions: wmaAccessPermit }),

  // --- Coverage sweep batch 3+4 (Fauquier->Culpeper + Shenandoah foothills) ---
  verifiedLocation({ id: "germantown-lake", name: "Germantown Lake (C.M. Crockett Park)", waterbody: "Germantown Lake", waterbodyType: "lake", county: "Fauquier", lat: 38.6212, lng: -77.7263, distanceMiles: 50, travelMinutes: 79, access: ["shore", "kayak"], accessAuthority: "Fauquier County Parks and Recreation", accessSourceUrl: "https://www.fauquiercounty.gov/government/departments-h-z/parks-and-recreation/facilities/parks/c-m-crockett-park" }),
  verifiedLocation({ id: "abel-lake", name: "Abel Reservoir", waterbody: "Abel Reservoir", waterbodyType: "reservoir", county: "Stafford", lat: 38.4132, lng: -77.4971, distanceMiles: 50, travelMinutes: 80, access: ["shore", "kayak"], accessAuthority: "Stafford County Parks, Recreation and Community Facilities", accessSourceUrl: "https://staffordcountyva.gov/government/departments_p-z/parks_and_recreation/facilities___rentals/fishing_and_boating.php" }),
  verifiedLocation({ id: "lake-mooney", name: "Lake Mooney (Smith Lake)", waterbody: "Lake Mooney", waterbodyType: "reservoir", county: "Stafford", lat: 38.337, lng: -77.552, distanceMiles: 58, travelMinutes: 92, access: ["shore", "kayak"], accessAuthority: "Stafford County", accessSourceUrl: "https://staffordcountyva.gov/news_detail_T5_R899.php" }),
  verifiedLocation({ id: "ni-river-reservoir", name: "Ni River Reservoir", waterbody: "Ni River Reservoir", waterbodyType: "reservoir", county: "Spotsylvania", lat: 38.2478, lng: -77.6029, distanceMiles: 66, travelMinutes: 106, access: ["shore", "kayak"], accessAuthority: "Spotsylvania County", accessSourceUrl: "https://www.spotsylvania.va.us/382/Reservoirs" }),
  verifiedLocation({ id: "lake-culpeper", name: "Lake Culpeper", waterbody: "Lake Culpeper", waterbodyType: "reservoir", county: "Culpeper", lat: 38.4654, lng: -78.0279, distanceMiles: 74, travelMinutes: 119, access: ["shore", "kayak"], accessAuthority: "Virginia DWR", accessSourceUrl: "https://dwr.virginia.gov/waterbody/lake-culpeper/", notice: "~75 min from the DC core." }),
  verifiedLocation({ id: "lake-anna-sp", name: "Lake Anna (Lake Anna State Park)", waterbody: "Lake Anna", waterbodyType: "reservoir", county: "Spotsylvania", lat: 38.1139, lng: -77.8355, distanceMiles: 85, travelMinutes: 136, access: ["shore", "kayak"], accessAuthority: "Virginia State Parks", accessSourceUrl: "https://www.dcr.virginia.gov/state-parks/lake-anna", notice: "~75-90 min from the DC core. Striped bass and hybrid stripers are stocked; a major multi-use reservoir." }),
  verifiedLocation({ id: "phelps-pond", name: "Phelps Pond (C.F. Phelps WMA)", waterbody: "Phelps Pond", waterbodyType: "pond", county: "Fauquier", lat: 38.4619, lng: -77.7502, distanceMiles: 59, travelMinutes: 94, access: ["shore"], accessAuthority: "Virginia Department of Wildlife Resources", accessSourceUrl: "https://dwr.virginia.gov/waterbody/phelps-pond/", accessConditions: wmaAccessPermit }),
  verifiedLocation({ id: "lake-arrowhead", name: "Lake Arrowhead (Luray)", waterbody: "Lake Arrowhead", waterbodyType: "lake", county: "Page", lat: 38.64081, lng: -78.3889, distanceMiles: 92, travelMinutes: 147, access: ["shore", "kayak"], accessAuthority: "Page County", accessSourceUrl: "https://pagecounty.virginia.gov/232/Recreation-Facilities" }),
  verifiedLocation({ id: "lake-laura", name: "Lake Laura (Bryce)", waterbody: "Lake Laura", waterbodyType: "lake", county: "Shenandoah", lat: 38.79798, lng: -78.79319, distanceMiles: 117, travelMinutes: 188, access: ["shore", "kayak"], accessAuthority: "Virginia DWR", accessSourceUrl: "https://dwr.virginia.gov/waterbody/lake-laura/" }),
  verifiedLocation({ id: "bealers-ferry-pond", name: "Bealers Ferry Pond (USFS Accessible Site)", waterbody: "Bealers Ferry Pond", waterbodyType: "pond", county: "Page", lat: 38.7507, lng: -78.43293, distanceMiles: 93, travelMinutes: 149, access: ["shore"], accessAuthority: "U.S. Forest Service", accessSourceUrl: "https://www.fs.usda.gov/r08/gwj/recreation/bealers-ferry-pond-accessible-fishing-site" }),
  verifiedLocation({ id: "lake-anna-accessible-pond", name: "Lake Anna State Park Accessible Fishing Pond", waterbody: "Lake Anna State Park Pond", waterbodyType: "pond", county: "Spotsylvania", lat: 38.11196, lng: -77.83114, distanceMiles: 85, travelMinutes: 136, access: ["shore"], accessAuthority: "Virginia State Parks", accessSourceUrl: "https://www.dcr.virginia.gov/state-parks/lake-anna" }),
  verifiedLocation({ id: "n-fauquier-pond-1", name: "Northern Fauquier Community Park Pond 1", waterbody: "Northern Fauquier Pond 1", waterbodyType: "pond", county: "Fauquier", lat: 38.86861, lng: -77.82373, distanceMiles: 50, travelMinutes: 81, access: ["shore"], accessAuthority: "Fauquier County Parks and Recreation", accessSourceUrl: "https://www.fauquiercounty.gov/government/departments-h-z/parks-and-recreation/facilities/parks/northern-fauquier-community-park" }),
  verifiedLocation({ id: "n-fauquier-pond-2", name: "Northern Fauquier Community Park Pond 2", waterbody: "Northern Fauquier Pond 2", waterbodyType: "pond", county: "Fauquier", lat: 38.86886, lng: -77.82734, distanceMiles: 51, travelMinutes: 81, access: ["shore"], accessAuthority: "Fauquier County Parks and Recreation", accessSourceUrl: "https://www.fauquiercounty.gov/government/departments-h-z/parks-and-recreation/facilities/parks/northern-fauquier-community-park" }),
  verifiedLocation({ id: "lakeside-lake", name: "Lakeside Lake (Bowman Library)", waterbody: "Lakeside Lake", waterbodyType: "lake", county: "Frederick", lat: 39.10204, lng: -78.19139, distanceMiles: 78, travelMinutes: 125, access: ["shore", "kayak"], accessAuthority: "Frederick County Parks and Recreation", accessSourceUrl: "https://www.fcva.us/departments/parks-recreation/parks-facilities/parks/bowman-lake-trail-and-amphitheater" }),
  verifiedLocation({ id: "tomahawk-pond", name: "Tomahawk Pond Day Use Area (USFS)", waterbody: "Tomahawk Pond", waterbodyType: "pond", county: "Shenandoah", lat: 38.75861, lng: -78.84139, distanceMiles: 121, travelMinutes: 194, access: ["shore"], accessAuthority: "U.S. Forest Service", accessSourceUrl: "https://www.fs.usda.gov/r08/gwj/recreation/tomahawk-pond-day-use-area", notice: "Small mountain pond; DWR stocks trout seasonally (~Oct 1-May 15). Far drive west." }),
  verifiedLocation({ id: "aquia-creek-widewater", name: "Aquia Creek at Widewater State Park", waterbody: "Aquia Creek", waterbodyType: "stream", county: "Stafford", lat: 38.4069, lng: -77.3274, distanceMiles: 45, travelMinutes: 72, access: ["shore"], accessAuthority: "Virginia State Parks", accessSourceUrl: "https://www.dcr.virginia.gov/state-parks/widewater", notice: "Widewater State Park authorizes fishing access, but Aquia Creek is tidal and can have strong currents, sudden drop-offs, and submerged obstructions. BiteMap does not list this as a wading access." }),
  verifiedLocation({ id: "jetts-creek-lands-end", name: "Jett's Creek at Land's End WMA", waterbody: "Jett's Creek", waterbodyType: "stream", county: "King George", lat: 38.1625, lng: -77.1035, distanceMiles: 64, travelMinutes: 102, access: ["shore"], accessAuthority: "Virginia Department of Wildlife Resources", accessSourceUrl: "https://dwr.virginia.gov/wma/lands-end/", notice: "Land's End WMA; a WMA access permit or valid VA license/registration is required. This is a tidal creek and BiteMap does not list it as a wading access.", accessConditions: wmaAccessPermit }),
  verifiedLocation({ id: "conway-river", name: "Conway River (Rapidan WMA / SNP)", waterbody: "Conway River", waterbodyType: "stream", county: "Madison", lat: 38.4115, lng: -78.4394, distanceMiles: 102, travelMinutes: 163, access: ["shore", "wade"], accessAuthority: "Virginia DWR / National Park Service", accessSourceUrl: "https://dwr.virginia.gov/wma/rapidan/", accessConditions: wmaAccessPermit }),
  verifiedLocation({ id: "west-naked-creek", name: "West Naked Creek (SNP)", waterbody: "West Naked Creek", waterbodyType: "stream", county: "Page", lat: 38.488, lng: -78.4994, distanceMiles: 103, travelMinutes: 165, access: ["shore", "wade"], accessAuthority: "National Park Service", accessSourceUrl: "https://www.nps.gov/shen/planyourvisit/fishing.htm" }),
  verifiedLocation({ id: "east-naked-creek", name: "East Naked Creek (SNP)", waterbody: "East Naked Creek", waterbodyType: "stream", county: "Page", lat: 38.477, lng: -78.482, distanceMiles: 102, travelMinutes: 164, access: ["shore", "wade"], accessAuthority: "National Park Service", accessSourceUrl: "https://www.nps.gov/shen/planyourvisit/fishing.htm" }),
  verifiedLocation({ id: "shenandoah-river-sp", name: "South Fork Shenandoah River at Shenandoah River State Park", waterbody: "South Fork Shenandoah River", waterbodyType: "river", county: "Warren", lat: 38.85466, lng: -78.30637, distanceMiles: 84, travelMinutes: 134, access: ["shore", "wade", "kayak"], accessAuthority: "Virginia DCR", accessSourceUrl: "https://www.dcr.virginia.gov/state-parks/shenandoah-river" }),
  verifiedLocation({ id: "seven-bends-sp", name: "North Fork Shenandoah River at Seven Bends State Park", waterbody: "North Fork Shenandoah River", waterbodyType: "river", county: "Shenandoah", lat: 38.8567, lng: -78.48959, distanceMiles: 96, travelMinutes: 154, access: ["shore", "wade", "kayak"], accessAuthority: "Virginia State Parks", accessSourceUrl: "https://www.dcr.virginia.gov/state-parks/seven-bends" }),
  verifiedLocation({ id: "whiteoak-canyon-run", name: "Whiteoak Canyon Run (SNP)", waterbody: "Whiteoak Canyon Run", waterbodyType: "stream", county: "Madison", lat: 38.55718, lng: -78.35548, distanceMiles: 92, travelMinutes: 147, access: ["shore", "wade"], accessAuthority: "Virginia DWR / NPS", accessSourceUrl: "https://www.nps.gov/shen/planyourvisit/fishing.htm" }),
  verifiedLocation({ id: "lake-thompson", name: "Lake Thompson (G.R. Thompson WMA)", waterbody: "Lake Thompson", waterbodyType: "lake", county: "Fauquier", lat: 38.95665, lng: -77.99332, distanceMiles: 62, travelMinutes: 100, access: ["shore", "kayak"], accessAuthority: "Virginia Department of Wildlife Resources", accessSourceUrl: "https://dwr.virginia.gov/waterbody/lake-thompson/", notice: "DWR has discontinued trout stocking here indefinitely due to inconsistent water levels; current fishery is limited.", accessConditions: wmaAccessPermit }),
  verifiedLocation({ id: "clearbrook-lake", name: "Clearbrook Park Lake", waterbody: "Clearbrook Lake", waterbodyType: "lake", county: "Frederick", lat: 39.25429, lng: -78.09439, distanceMiles: 76, travelMinutes: 122, access: ["shore", "kayak"], accessAuthority: "Virginia DWR", accessSourceUrl: "https://dwr.virginia.gov/waterbody/clearbrook-lake/" }),
  verifiedLocation({ id: "sherando-park-lake", name: "Sherando Park Lake", waterbody: "Sherando Park Lake", waterbodyType: "lake", county: "Frederick", lat: 39.07263, lng: -78.18746, distanceMiles: 77, travelMinutes: 124, access: ["shore", "kayak"], accessAuthority: "Frederick County Parks and Recreation", accessSourceUrl: "https://www.fcva.us/departments/parks-recreation/parks/sherando-park" }),
  verifiedLocation({ id: "cave-pond", name: "Cave Pond Pocket Park (Luray)", waterbody: "Cave Pond", waterbodyType: "pond", county: "Page", lat: 38.66436, lng: -78.47954, distanceMiles: 98, travelMinutes: 156, access: ["shore"], accessAuthority: "Town of Luray", accessSourceUrl: "https://www.townofluray.com/parks/pocket-parks", accessConditions: [{ kind: "harvest", label: "Catch-and-release only", detail: "The Town of Luray identifies Cave Pond as a catch-and-release fishing pond." }] }),
  verifiedLocation({ id: "big-gem-pond", name: "Big Gem Park Fishing Pond", waterbody: "Big Gem Park Pond", waterbodyType: "pond", county: "Page", lat: 38.48209, lng: -78.61683, distanceMiles: 111, travelMinutes: 178, access: ["shore"], accessAuthority: "Town of Shenandoah", accessSourceUrl: "https://www.townofshenandoah.com/parksrec/page/big-gem-park" }),
  verifiedLocation({ id: "long-pond-widewater", name: "Long Pond (Widewater State Park)", waterbody: "Long Pond", waterbodyType: "pond", county: "Stafford", lat: 38.4101, lng: -77.32528, distanceMiles: 45, travelMinutes: 72, access: ["shore"], accessAuthority: "Virginia State Parks", accessSourceUrl: "https://www.dcr.virginia.gov/state-parks/widewater" }),
  verifiedLocation({ id: "yowell-meadow-pond", name: "Yowell Meadow Park Pond", waterbody: "Yowell Meadow Pond", waterbodyType: "pond", county: "Culpeper", lat: 38.47479, lng: -78.00047, distanceMiles: 72, travelMinutes: 116, access: ["shore"], accessAuthority: "Town of Culpeper", accessSourceUrl: "https://www.culpeperva.gov/", accessStatus: "listed", notice: "The pond sits in public Yowell Meadow Park, but BiteMap has not yet attached a specific current Town page confirming fishing permission at this waypoint. Confirm posted park rules before fishing." }),
  verifiedLocation({ id: "nanzattico-bay", name: "Nanzattico Bay at Land's End WMA", waterbody: "Nanzattico Bay", waterbodyType: "stream", county: "King George", lat: 38.16294, lng: -77.127, distanceMiles: 64, travelMinutes: 102, access: ["shore"], accessAuthority: "Virginia Department of Wildlife Resources", accessSourceUrl: "https://dwr.virginia.gov/wma/lands-end/", notice: "Land's End WMA (WMA access permit or VA license required). This is a tidal Rappahannock embayment and BiteMap does not list it as a wading access.", accessConditions: wmaAccessPermit }),
];
