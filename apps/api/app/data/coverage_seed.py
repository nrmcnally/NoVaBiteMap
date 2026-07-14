from __future__ import annotations

FAIRFAX_FISHING = "https://www.fairfaxcounty.gov/parks/fishing"
FAIRFAX_SMALL_LAKES = "https://www.fairfaxcounty.gov/parks/small-lakes"
NPS_GWMP = "https://www.nps.gov/gwmp/planyourvisit/fishing.htm"
NPS_GREAT_FALLS = "https://www.nps.gov/grfa/planyourvisit/outdooractivities.htm"
NOVA_FOUNTAINHEAD = "https://www.novaparks.com/parks/fountainhead-regional-park/things-to-do/fishing"
NOVA_BULL_RUN = "https://www.novaparks.com/parks/bull-run-marina/things-to-do/fishing"
NOVA_POHICK = "https://www.novaparks.com/parks/pohick-bay-regional-park/things-to-do/fishing"
NOVA_ALGONKIAN = "https://www.novaparks.com/parks/algonkian-regional-park/things-to-do/fishing"
NOVA_PISCATAWAY = "https://www.novaparks.com/parks/piscataway-crossing-regional-park/things-to-do/fishing"
NOVA_SENECA = "https://www.novaparks.com/parks/seneca-regional-park/things-to-do/fishing"
NOVA_OCCOQUAN = "https://www.novaparks.com/parks/occoquan-regional-park/things-to-do/fishing"
NOVA_RESERVOIR = "https://www.novaparks.com/parks/reservoir-park/things-to-do/fishing"
DCR_FISHING = "https://www.dcr.virginia.gov/state-parks/fishing"
DCR_LEESYLVANIA = "https://www.dcr.virginia.gov/state-parks/leesylvania"
DCR_MASON_NECK = "https://www.dcr.virginia.gov/state-parks/mason-neck"
PWC_FISHING = "https://www.pwcva.gov/department/parks-recreation/fishing/"


def species_evidence(source: str, source_name: str, values: dict[str, float], context: str) -> dict:
    return {
        species_id: {
            "availability": availability,
            "quality": None,
            "evidence_confidence": 0.76,
            "evidence_type": "official listing",
            "source": source,
            "source_name": source_name,
            "summary": f"{source_name} lists {context}; BiteMap keeps the score conservative until a site survey is attached.",
        }
        for species_id, availability in values.items()
    }


def coverage_location(
    id: str,
    name: str,
    waterbody: str,
    county: str,
    lat: float,
    lon: float,
    travel_minutes: int,
    access: list[str],
    source_name: str,
    source: str,
    evidence: dict | None = None,
    aliases: list[str] | None = None,
) -> dict:
    return {
        "id": id,
        "name": name,
        "waterbody": waterbody,
        "county": county,
        "latitude": lat,
        "longitude": lon,
        "travel_minutes": travel_minutes,
        "access": access,
        "public_access": True,
        "source": source,
        "source_name": source_name,
        "source_reviewed": "2026-07-13",
        "aliases": aliases or [],
        "activity_estimate": 0.5,
        "species_evidence": evidence or {},
    }


fairfax_name = "Fairfax County Park Authority"
nova_name = "NOVA Parks"
pwc_name = "Prince William County Parks"
nps_name = "National Park Service"
dcr_name = "Virginia State Parks"

lake_fairfax_evidence = species_evidence(
    FAIRFAX_FISHING,
    fairfax_name,
    {"bluegill": 0.80, "black-crappie": 0.70},
    "bluegill and black crappie at Lake Fairfax",
)
riverbend_evidence = species_evidence(
    FAIRFAX_FISHING,
    fairfax_name,
    {"smallmouth-bass": 0.86, "channel-catfish": 0.72},
    "smallmouth bass and channel catfish at Riverbend Park",
)
accotink_evidence = species_evidence(
    FAIRFAX_FISHING,
    fairfax_name,
    {"bluegill": 0.48},
    "limited bluegill fishing at shallow Lake Accotink",
)
fountainhead_evidence = species_evidence(NOVA_FOUNTAINHEAD, nova_name, {"bluegill": 0.74}, "bluegill at Fountainhead")
pohick_evidence = species_evidence(
    NOVA_POHICK,
    nova_name,
    {"largemouth-bass": 0.75, "bluegill": 0.78, "common-carp": 0.69, "striped-bass": 0.58},
    "largemouth bass, bluegill, carp, and striped bass at Pohick Bay",
)
occoquan_evidence = species_evidence(
    NOVA_OCCOQUAN,
    nova_name,
    {"largemouth-bass": 0.76, "white-perch": 0.72, "striped-bass": 0.62, "yellow-perch": 0.66, "flathead-catfish": 0.64, "channel-catfish": 0.72},
    "six named species at Occoquan Regional Park",
)
reservoir_evidence = species_evidence(
    NOVA_RESERVOIR,
    nova_name,
    {"largemouth-bass": 0.77, "common-carp": 0.68},
    "largemouth bass and carp at Beaverdam Reservoir",
)
pwc_lake_evidence = species_evidence(
    PWC_FISHING,
    pwc_name,
    {"largemouth-bass": 0.74, "channel-catfish": 0.74, "bluegill": 0.79},
    "largemouth bass, channel catfish, and bluegill across its primary fishing parks",
)


COVERAGE_LOCATIONS = [
    coverage_location("lake-fairfax", "Lake Fairfax Park", "Lake Fairfax", "Fairfax", 38.961164, -77.318652, 24, ["shore", "kayak"], fairfax_name, FAIRFAX_FISHING, lake_fairfax_evidence, ["Lake Fairfax"]),
    coverage_location("riverbend-park", "Riverbend Park", "Potomac River", "Fairfax", 39.019261, -77.250371, 31, ["shore", "kayak", "boat"], fairfax_name, FAIRFAX_FISHING, riverbend_evidence),
    coverage_location("lake-accotink", "Lake Accotink Park", "Lake Accotink", "Fairfax", 38.801697, -77.228921, 20, ["shore", "kayak"], fairfax_name, FAIRFAX_FISHING, accotink_evidence, ["Accotink"]),
    coverage_location("huntsman-lake", "Huntsman Lake", "Huntsman Lake", "Fairfax", 38.755066, -77.259976, 22, ["shore", "kayak"], fairfax_name, FAIRFAX_SMALL_LAKES),
    coverage_location("royal-lake", "Royal Lake Park", "Royal Lake", "Fairfax", 38.802731, -77.288804, 18, ["shore"], fairfax_name, FAIRFAX_SMALL_LAKES, aliases=["Lake Royal", "Lakeside Park"]),
    coverage_location("walney-pond", "Walney Pond", "Walney Pond", "Fairfax", 38.853730, -77.430640, 19, ["shore"], fairfax_name, FAIRFAX_FISHING, aliases=["Ellanor C. Lawrence Park", "ECLP"]),
    coverage_location("hidden-pond", "Hidden Pond Nature Center", "Hidden Pond", "Fairfax", 38.772286, -77.238740, 21, ["shore"], fairfax_name, FAIRFAX_FISHING),
    coverage_location("lake-mercer", "Lake Mercer", "Lake Mercer", "Fairfax", 38.739847, -77.257314, 25, ["shore", "kayak"], fairfax_name, FAIRFAX_SMALL_LAKES, aliases=["Recreation Lake Park"]),
    coverage_location("woodglen-lake", "Woodglen Lake Park", "Woodglen Lake", "Fairfax", 38.806485, -77.314842, 16, ["shore", "kayak"], fairfax_name, FAIRFAX_SMALL_LAKES, aliases=["Woodglen Lake"]),

    coverage_location("vernon-view", "Vernon View Drive", "Potomac River", "Fairfax", 38.718131, -77.062311, 37, ["shore"], nps_name, NPS_GWMP),
    coverage_location("riverside-park-potomac", "Riverside Park", "Potomac River", "Fairfax", 38.711382, -77.072716, 38, ["shore"], nps_name, NPS_GWMP, aliases=["Riverside Park Fort Hunt"]),
    coverage_location("dyke-marsh", "Dyke Marsh", "Potomac River", "Fairfax", 38.762879, -77.046790, 36, ["shore", "kayak", "boat"], nps_name, NPS_GWMP, aliases=["Dyke Marsh Wildlife Preserve"]),
    coverage_location("belle-haven", "Belle Haven", "Potomac River", "Fairfax", 38.777578, -77.049072, 34, ["shore", "kayak", "boat"], nps_name, NPS_GWMP, aliases=["Belle Haven Marina"]),
    coverage_location("jones-point", "Jones Point Park", "Potomac River", "Alexandria", 38.793261, -77.042644, 32, ["shore"], nps_name, NPS_GWMP, aliases=["Jones Point"]),
    coverage_location("daingerfield-island", "Daingerfield Island", "Potomac River", "Alexandria", 38.831183, -77.041242, 29, ["shore"], nps_name, NPS_GWMP),
    coverage_location("roaches-run", "Roaches Run", "Roaches Run Waterfowl Sanctuary", "Arlington", 38.864588, -77.044440, 28, ["shore"], nps_name, NPS_GWMP, aliases=["Roaches Run Waterfowl Sanctuary"]),
    coverage_location("gravelly-point", "Gravelly Point", "Potomac River", "Arlington", 38.865037, -77.039513, 28, ["shore"], nps_name, NPS_GWMP),
    coverage_location("theodore-roosevelt-island", "Theodore Roosevelt Island", "Potomac River", "Arlington", 38.895410, -77.062202, 27, ["shore"], nps_name, NPS_GWMP, aliases=["TR Island"]),

    coverage_location("fountainhead", "Fountainhead Regional Park", "Occoquan Reservoir", "Fairfax", 38.723588, -77.326156, 28, ["shore", "kayak", "boat"], nova_name, NOVA_FOUNTAINHEAD, fountainhead_evidence),
    coverage_location("bull-run-marina", "Bull Run Marina", "Occoquan Reservoir", "Fairfax", 38.742443, -77.387518, 29, ["shore", "kayak", "boat"], nova_name, NOVA_BULL_RUN),
    coverage_location("pohick-bay", "Pohick Bay Regional Park", "Pohick Bay", "Fairfax", 38.678859, -77.190496, 36, ["shore", "kayak", "boat"], nova_name, NOVA_POHICK, pohick_evidence),
    coverage_location("algonkian", "Algonkian Regional Park", "Potomac River", "Loudoun", 39.058020, -77.380188, 34, ["shore", "kayak", "boat"], nova_name, NOVA_ALGONKIAN),
    coverage_location("piscataway-crossing", "Piscataway Crossing Regional Park", "Potomac River", "Loudoun", 39.197251, -77.484365, 47, ["shore", "kayak"], nova_name, NOVA_PISCATAWAY, aliases=["White's Ford", "Whites Ford"]),
    coverage_location("seneca-regional", "Seneca Regional Park", "Potomac River", "Fairfax", 39.052593, -77.324984, 32, ["shore"], nova_name, NOVA_SENECA),
    coverage_location("occoquan-regional", "Occoquan Regional Park", "Occoquan River", "Fairfax", 38.684466, -77.241590, 32, ["shore", "kayak", "boat"], nova_name, NOVA_OCCOQUAN, occoquan_evidence),
    coverage_location("beaverdam-reservoir", "Reservoir Park", "Beaverdam Reservoir", "Loudoun", 39.002427, -77.536149, 32, ["shore", "kayak", "boat"], nova_name, NOVA_RESERVOIR, reservoir_evidence, ["Beaverdam Reservoir", "Beaverdam Reservoir Park"]),

    coverage_location("leesylvania", "Leesylvania State Park", "Potomac River", "Prince William", 38.590830, -77.253208, 43, ["shore", "kayak", "boat"], dcr_name, DCR_LEESYLVANIA, species_evidence(DCR_FISHING, dcr_name, {"largemouth-bass": 0.70}, "good largemouth bass fishing on this freshwater Potomac reach")),
    coverage_location("mason-neck", "Mason Neck State Park", "Belmont Bay", "Fairfax", 38.648520, -77.181379, 39, ["kayak", "boat"], dcr_name, DCR_MASON_NECK, species_evidence(DCR_FISHING, dcr_name, {"largemouth-bass": 0.70}, "good largemouth bass fishing on this freshwater Potomac reach")),

    coverage_location("lake-ridge-marina", "Lake Ridge Golf & Marina", "Occoquan Reservoir", "Prince William", 38.691157, -77.318267, 31, ["shore", "kayak", "boat"], pwc_name, PWC_FISHING, pwc_lake_evidence, ["Lake Ridge Park Marina"]),
    coverage_location("locust-shade", "Locust Shade Park", "Locust Shade Pond", "Prince William", 38.531039, -77.354870, 46, ["shore", "boat"], pwc_name, PWC_FISHING, pwc_lake_evidence),
    coverage_location("silver-lake", "Silver Lake Regional Park", "Silver Lake", "Prince William", 38.842712, -77.664715, 40, ["shore", "kayak", "boat"], pwc_name, PWC_FISHING, pwc_lake_evidence),
    coverage_location("marumsco-acre-lake", "Marumsco Acre Lake Park", "Marumsco Acre Lake", "Prince William", 38.640112, -77.252509, 38, ["shore"], pwc_name, PWC_FISHING),
    coverage_location("occoquan-hand-carry", "Occoquan Hand Carry Launch", "Occoquan River", "Prince William", 38.706036, -77.447770, 31, ["shore", "kayak"], pwc_name, PWC_FISHING, aliases=["Hinson Mill Lane"]),

    coverage_location("great-falls", "Great Falls Park", "Potomac River", "Fairfax", 38.990455, -77.251843, 29, ["shore"], nps_name, NPS_GREAT_FALLS, aliases=["Fisherman's Eddy", "Fishermans Eddy"]),
]
