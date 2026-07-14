import type { AccessMethod, FishingLocationSeed, SpeciesEvidence } from "./data";

const reviewed = "Official source reviewed 2026-07-13";

const sources = {
  fairfaxFishing: "https://www.fairfaxcounty.gov/parks/fishing",
  fairfaxSmallLakes: "https://www.fairfaxcounty.gov/parks/small-lakes",
  npsGwmp: "https://www.nps.gov/gwmp/planyourvisit/fishing.htm",
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
  sourceReviewed: "2026-07-13",
});

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
  verifiedLocation({ id: "beaverdam-reservoir", name: "Reservoir Park", waterbody: "Beaverdam Reservoir", waterbodyType: "reservoir", county: "Loudoun", lat: 39.002427, lng: -77.536149, distanceMiles: 22, travelMinutes: 32, access: ["shore", "kayak", "boat"], aliases: ["Beaverdam Reservoir", "Beaverdam Reservoir Park"], accessAuthority: novaName, accessSourceUrl: sources.novaReservoir, evidence: reservoirEvidence, notice: "Fishing is allowed only in designated shoreline and water areas. Gas motors, swimming, and wading are prohibited; observe the dam restriction zone." }),

  verifiedLocation({ id: "leesylvania", name: "Leesylvania State Park", waterbody: "Potomac River", waterbodyType: "river", county: "Prince William", lat: 38.59083, lng: -77.253208, distanceMiles: 31, travelMinutes: 43, access: ["shore", "kayak", "boat"], accessAuthority: "Virginia State Parks", accessSourceUrl: sources.dcrLeesylvania, evidence: dcrLargemouthEvidence("Leesylvania", sources.dcrFishing) }),
  verifiedLocation({ id: "mason-neck", name: "Mason Neck State Park", waterbody: "Belmont Bay", waterbodyType: "bay", county: "Fairfax", lat: 38.64852, lng: -77.181379, distanceMiles: 27, travelMinutes: 39, access: ["kayak", "boat"], accessAuthority: "Virginia State Parks", accessSourceUrl: sources.dcrMasonNeck, evidence: dcrLargemouthEvidence("Mason Neck", sources.dcrFishing), notice: "Mason Neck allows fishing from car-top craft on Belmont Bay; fishing from park trails is not permitted. Fresh and brackish licenses differ." }),

  verifiedLocation({ id: "lake-ridge-marina", name: "Lake Ridge Golf & Marina", waterbody: "Occoquan Reservoir", waterbodyType: "reservoir", county: "Prince William", lat: 38.691157, lng: -77.318267, distanceMiles: 21, travelMinutes: 31, access: ["shore", "kayak", "boat"], aliases: ["Lake Ridge Park Marina"], accessAuthority: pwcName, accessSourceUrl: sources.pwcFishing, evidence: pwcLakeEvidence, notice: "Prince William County lists a concrete ramp and a 10-horsepower limit. Verify current rental and operating hours." }),
  verifiedLocation({ id: "locust-shade", name: "Locust Shade Park", waterbody: "Locust Shade Pond", waterbodyType: "pond", county: "Prince William", lat: 38.531039, lng: -77.35487, distanceMiles: 35, travelMinutes: 46, access: ["shore", "boat"], accessAuthority: pwcName, accessSourceUrl: sources.pwcFishing, evidence: pwcLakeEvidence }),
  verifiedLocation({ id: "silver-lake", name: "Silver Lake Regional Park", waterbody: "Silver Lake", waterbodyType: "lake", county: "Prince William", lat: 38.842712, lng: -77.664715, distanceMiles: 27, travelMinutes: 40, access: ["shore", "kayak", "boat"], accessAuthority: pwcName, accessSourceUrl: sources.pwcFishing, evidence: pwcLakeEvidence, notice: "The county permits personally owned non-motorized boats and does not provide rentals at this park." }),
  verifiedLocation({ id: "marumsco-acre-lake", name: "Marumsco Acre Lake Park", waterbody: "Marumsco Acre Lake", waterbodyType: "lake", county: "Prince William", lat: 38.640112, lng: -77.252509, distanceMiles: 27, travelMinutes: 38, access: ["shore"], accessAuthority: pwcName, accessSourceUrl: sources.pwcFishing }),
  verifiedLocation({ id: "occoquan-hand-carry", name: "Occoquan Hand Carry Launch", waterbody: "Occoquan River", waterbodyType: "river", county: "Prince William", lat: 38.706036, lng: -77.44777, distanceMiles: 20, travelMinutes: 31, access: ["shore", "kayak"], aliases: ["Hinson Mill Lane"], accessAuthority: pwcName, accessSourceUrl: sources.pwcFishing, notice: "The launch requires carrying a boat about 400 feet down a trail. The return is upstream and uphill; plan a downstream takeout when appropriate." }),

  verifiedLocation({ id: "great-falls", name: "Great Falls Park", waterbody: "Potomac River", waterbodyType: "river", county: "Fairfax", lat: 38.990455, lng: -77.251843, distanceMiles: 17, travelMinutes: 29, access: ["shore"], aliases: ["Fisherman's Eddy", "Fishermans Eddy"], accessAuthority: "National Park Service", accessSourceUrl: sources.npsGreatFalls, notice: "NPS permits fishing with a Virginia or Maryland license. Keep away from cliffs, falls, and restricted water; fishing access does not imply permission to wade." }),
];
