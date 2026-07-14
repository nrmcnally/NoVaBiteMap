from __future__ import annotations

from .coverage_seed import COVERAGE_LOCATIONS

ACCESS_SOURCE = "https://services.dwr.virginia.gov/arcgis/rest/services/Public/BoatingAccessSites/FeatureServer/0"
SHENANDOAH_SOURCE = "https://dwr.virginia.gov/blog/five-great-places-in-the-northern-shenandoah-valley-to-fish-after-work/"
WALLEYE_SOURCE = "https://dwr.virginia.gov/wp-content/uploads/media/Walleye-Fishing-Forecast-2026.pdf"
VDH_ADVISORY_SOURCE = "https://www.vdh.virginia.gov/environmental-health/public-health-toxicology/fish-consumption-advisory/"

SPECIES = [
    {"id": "smallmouth-bass", "common_name": "Smallmouth bass", "scientific_name": "Micropterus dolomieu", "code": "SMB", "aliases": ["smallie", "smallmouth"]},
    {"id": "largemouth-bass", "common_name": "Largemouth bass", "scientific_name": "Micropterus salmoides", "code": "LMB", "aliases": ["largemouth", "bucketmouth"]},
    {"id": "spotted-bass", "common_name": "Spotted bass", "scientific_name": "Micropterus punctulatus", "code": "SPB", "aliases": ["spot"]},
    {"id": "bluegill", "common_name": "Bluegill", "scientific_name": "Lepomis macrochirus", "code": "BG", "aliases": ["bream"]},
    {"id": "redbreast-sunfish", "common_name": "Redbreast sunfish", "scientific_name": "Lepomis auritus", "code": "RBS", "aliases": ["redbreast"]},
    {"id": "black-crappie", "common_name": "Black crappie", "scientific_name": "Pomoxis nigromaculatus", "code": "BCP", "aliases": ["crappie"]},
    {"id": "white-crappie", "common_name": "White crappie", "scientific_name": "Pomoxis annularis", "code": "WCP", "aliases": []},
    {"id": "channel-catfish", "common_name": "Channel catfish", "scientific_name": "Ictalurus punctatus", "code": "CCF", "aliases": ["channel cat"]},
    {"id": "blue-catfish", "common_name": "Blue catfish", "scientific_name": "Ictalurus furcatus", "code": "BCF", "aliases": ["blue cat"]},
    {"id": "flathead-catfish", "common_name": "Flathead catfish", "scientific_name": "Pylodictis olivaris", "code": "FCF", "aliases": ["flathead"]},
    {"id": "rainbow-trout", "common_name": "Rainbow trout", "scientific_name": "Oncorhynchus mykiss", "code": "RBT", "aliases": ["rainbow"]},
    {"id": "brown-trout", "common_name": "Brown trout", "scientific_name": "Salmo trutta", "code": "BNT", "aliases": ["brown"]},
    {"id": "brook-trout", "common_name": "Brook trout", "scientific_name": "Salvelinus fontinalis", "code": "BKT", "aliases": ["brookie"]},
    {"id": "common-carp", "common_name": "Common carp", "scientific_name": "Cyprinus carpio", "code": "CARP", "aliases": ["carp"]},
    {"id": "northern-snakehead", "common_name": "Northern snakehead", "scientific_name": "Channa argus", "code": "NSH", "aliases": ["snakehead"]},
    {"id": "walleye", "common_name": "Walleye", "scientific_name": "Sander vitreus", "code": "WAE", "aliases": ["wall-eye"]},
    {"id": "yellow-perch", "common_name": "Yellow perch", "scientific_name": "Perca flavescens", "code": "YEP", "aliases": ["perch"]},
    {"id": "white-perch", "common_name": "White perch", "scientific_name": "Morone americana", "code": "WHP", "aliases": []},
    {"id": "striped-bass", "common_name": "Striped bass", "scientific_name": "Morone saxatilis", "code": "STB", "aliases": ["striper"]},
    {"id": "muskellunge", "common_name": "Muskellunge", "scientific_name": "Esox masquinongy", "code": "MUS", "aliases": ["musky", "muskie"]},
]


def river_evidence(main_stem: bool = False) -> dict:
    result = {
        "smallmouth-bass": {
            "availability": 0.91,
            "quality": 0.78,
            "evidence_confidence": 0.88,
            "evidence_type": "official listing",
            "source": SHENANDOAH_SOURCE,
            "summary": "Virginia DWR identifies the Shenandoah as a smallmouth fishery.",
        }
    }
    if main_stem:
        result["walleye"] = {
            "availability": 0.74,
            "quality": 0.63,
            "evidence_confidence": 0.74,
            "evidence_type": "official listing",
            "source": SHENANDOAH_SOURCE,
            "summary": "Virginia DWR describes walleye in the main-stem Shenandoah.",
        }
    return result


def location(
    id: str,
    name: str,
    waterbody: str,
    county: str,
    lat: float,
    lon: float,
    travel_minutes: int,
    access: list[str],
    evidence: dict | None = None,
    aliases: list[str] | None = None,
    activity_estimate: float = 0.5,
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
        "source": ACCESS_SOURCE,
        "source_name": "Virginia Department of Wildlife Resources",
        "source_reviewed": "2026-07-13",
        "aliases": aliases or [],
        "activity_estimate": activity_estimate,
        "species_evidence": evidence or {},
    }


LOCATIONS = [
    location("lake-burke", "Lake Burke", "Lake Burke", "Fairfax", 38.756407, -77.301343, 31, ["shore", "kayak", "boat"], {
        "largemouth-bass": {"availability": 0.86, "quality": 0.72, "evidence_confidence": 0.80, "evidence_type": "official listing", "source": "https://dwr.virginia.gov/blog/angler-spotlight-meet-khanh-nguyen/", "summary": "DWR material documents the lake's bass fishery."},
        "black-crappie": {"availability": 0.78, "quality": 0.62, "evidence_confidence": 0.72, "evidence_type": "official listing", "source": "https://dwr.virginia.gov/blog/angler-spotlight-meet-khanh-nguyen/", "summary": "DWR material documents crappie at Burke Lake."},
        "yellow-perch": {"availability": 0.70, "quality": None, "evidence_confidence": 0.66, "evidence_type": "official listing", "source": "https://dwr.virginia.gov/blog/angler-spotlight-meet-khanh-nguyen/", "summary": "DWR material documents yellow perch at Burke Lake."},
    }, ["Burke Lake", "Burke Lake Park"], 0.69),
    location("lake-brittle", "Lake Brittle", "Lake Brittle", "Fauquier", 38.747826, -77.691239, 38, ["shore", "kayak", "boat"], {
        "walleye": {"availability": 0.43, "quality": 0.38, "evidence_confidence": 0.62, "evidence_type": "agency survey", "source": WALLEYE_SOURCE, "summary": "DWR reports no walleye in the 2025 survey, notes some may remain, and says current stocking focuses on saugeye."}
    }, ["Brittle Lake"], 0.64),
    location("lake-frederick", "Lake Frederick", "Wheatlands Lake", "Frederick", 39.043012, -78.156883, 57, ["shore", "kayak", "boat"], {
        "largemouth-bass": {"availability": 0.82, "quality": 0.64, "evidence_confidence": 0.76, "evidence_type": "official listing", "source": SHENANDOAH_SOURCE, "summary": "A Virginia DWR regional feature lists largemouth bass at Lake Frederick."},
        "black-crappie": {"availability": 0.76, "quality": None, "evidence_confidence": 0.68, "evidence_type": "official listing", "source": SHENANDOAH_SOURCE, "summary": "A Virginia DWR regional feature lists crappie at Lake Frederick."},
    }, ["Wheatlands Lake"], 0.68),
    location("point-of-rocks", "McKimmey (Point of Rocks)", "Potomac River", "Loudoun", 39.272516, -77.546888, 48, ["shore", "kayak", "boat"], aliases=["Point of Rocks", "McKimmey"]),
    location("lake-curtis", "Lake Curtis", "Lake Curtis", "Stafford", 38.436285, -77.561260, 54, ["shore", "kayak", "boat"], aliases=["Curtis Lake"]),
    location("rocky-pen-park", "Rocky Pen Park", "Rocky Pen Run Reservoir", "Stafford", 38.334227, -77.543775, 62, ["shore", "kayak", "boat"], aliases=["Rocky Pen Run"]),
    location("berrys", "Berry's", "South Fork Shenandoah River", "Clarke", 39.041631, -77.999671, 54, ["shore", "kayak", "boat"], river_evidence(), activity_estimate=0.75),
    location("castlemans-ferry", "Castleman's Ferry", "Shenandoah River", "Clarke", 39.123933, -77.891047, 57, ["shore", "kayak", "boat"], river_evidence(True), activity_estimate=0.73),
    location("lockes", "Lockes", "Shenandoah River", "Clarke", 39.101569, -77.964838, 58, ["shore", "kayak", "boat"], river_evidence(True), activity_estimate=0.71),
    location("bentonville", "Bentonville", "South Fork Shenandoah River", "Warren", 38.840096, -78.330420, 68, ["shore", "wade", "kayak", "boat"], river_evidence(), activity_estimate=0.78),
    location("catletts-ford", "Catletts Ford Landing", "North Fork Shenandoah River", "Warren", 38.978482, -78.258715, 64, ["shore", "wade", "kayak", "boat"], river_evidence(), activity_estimate=0.72),
    location("front-royal", "Front Royal", "South Fork Shenandoah River", "Warren", 38.913697, -78.209740, 56, ["shore", "kayak", "boat"], river_evidence(), activity_estimate=0.76),
    location("karo", "Karo", "South Fork Shenandoah River", "Warren", 38.871521, -78.252644, 61, ["shore", "wade", "kayak", "boat"], river_evidence(), activity_estimate=0.80),
    location("morgans-ford", "Morgan's Ford", "Main Stem Shenandoah River", "Warren", 38.957833, -78.121708, 55, ["shore", "wade", "kayak", "boat"], river_evidence(True), activity_estimate=0.82),
    location("riverton", "Riverton", "North Fork Shenandoah River", "Warren", 38.949632, -78.198084, 58, ["shore", "kayak", "boat"], river_evidence(), activity_estimate=0.74),
    location("simpsons", "Simpson's", "South Fork Shenandoah River", "Warren", 38.878751, -78.261977, 64, ["shore", "wade", "kayak", "boat"], river_evidence(), activity_estimate=0.77),
] + COVERAGE_LOCATIONS


OCCOQUAN_ADVISORY_IDS = {
    "fountainhead",
    "bull-run-marina",
    "lake-ridge-marina",
    "occoquan-regional",
    "mason-neck",
}


def consumption_advisory(location_record: dict) -> dict:
    common = {
        "source_name": "Virginia Department of Health",
        "source_url": VDH_ADVISORY_SOURCE,
        "reviewed": "2026-07-13",
    }
    waterbody = location_record["waterbody"]
    location_id = location_record["id"]

    if "Shenandoah" in waterbody:
        return {
            **common,
            "status": "active",
            "label": "VDH consumption advisory",
            "summary": "VDH lists PCB and mercury meal limits across Shenandoah segments, including do-not-eat guidance for some species and reaches.",
            "contaminants": ["PCBs", "Mercury"],
        }
    if location_id in OCCOQUAN_ADVISORY_IDS:
        return {
            **common,
            "status": "active",
            "label": "VDH PFOS advisory",
            "summary": "VDH advises no largemouth bass meals from specified Occoquan River and Reservoir reaches and limits bluegill in the wider watershed.",
            "contaminants": ["PFOS"],
        }
    if location_id == "pohick-bay":
        return {
            **common,
            "status": "active",
            "label": "VDH PCB advisory",
            "summary": "VDH lists species-specific PCB restrictions for tidal Potomac tributaries and embayments that include Pohick Creek.",
            "contaminants": ["PCBs"],
        }
    if waterbody == "Potomac River":
        return {
            **common,
            "status": "jurisdiction-check",
            "label": "Check exact jurisdiction",
            "summary": "Potomac harvest guidance can depend on the exact Virginia, Maryland, or DC bank and river segment. Check the applicable advisory before keeping fish.",
            "contaminants": [],
        }
    return {
        **common,
        "status": "no-advisory-found",
        "label": "No VDH advisory match found",
        "summary": "No matching location was found in the current VDH table during this review. That is not a guarantee that fish are safe to eat.",
        "contaminants": [],
    }


for location_record in LOCATIONS:
    location_record["consumption_advisory"] = consumption_advisory(location_record)
