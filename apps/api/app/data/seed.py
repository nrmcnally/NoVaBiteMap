from __future__ import annotations

from .coverage_seed import COVERAGE_LOCATIONS

ACCESS_SOURCE = "https://services.dwr.virginia.gov/arcgis/rest/services/Public/BoatingAccessSites/FeatureServer/0"
SHENANDOAH_SOURCE = "https://dwr.virginia.gov/blog/five-great-places-in-the-northern-shenandoah-valley-to-fish-after-work/"
WALLEYE_SOURCE = "https://dwr.virginia.gov/wp-content/uploads/media/Walleye-Fishing-Forecast-2026.pdf"
VDH_ADVISORY_SOURCE = "https://www.vdh.virginia.gov/environmental-health/public-health-toxicology/fish-consumption-advisory/"
VDH_POTOMAC_2026 = "https://www.vdh.virginia.gov/content/uploads/sites/20/PotomacRiver_2026-1.pdf"
VDH_SHENANDOAH_2025 = "https://www.vdh.virginia.gov/content/uploads/sites/20/2025/06/ShenandoahRiver_2025.pdf"

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
    location("berrys", "Berry's", "Shenandoah River", "Clarke", 39.041631, -77.999671, 54, ["shore", "kayak", "boat"], river_evidence(True), activity_estimate=0.75),
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


SHENANDOAH_PCB_IDS = {"front-royal", "riverton", "morgans-ford", "berrys", "castlemans-ferry", "lockes"}
SHENANDOAH_MERCURY_IDS = {"bentonville", "karo", "simpsons", "front-royal", "riverton"}
POTOMAC_TIDAL_TRIBUTARY_IDS = {"pohick-bay", "occoquan-regional"}
OCCOQUAN_ADVISORY_IDS = {
    "fountainhead",
    "bull-run-marina",
    "lake-ridge-marina",
    "occoquan-regional",
    "mason-neck",
}
BOUNDARY_CHECK_IDS = {"occoquan-hand-carry", "roaches-run"}


def restriction(id: str, severity: str, label: str, species_label: str, species_ids: list[str], contaminant: str, *, size_qualifier: str | None = None, applies_to_all_species: bool = False) -> dict:
    return {
        "id": id,
        "severity": severity,
        "label": label,
        "species_label": species_label,
        "species_ids": species_ids,
        "contaminant": contaminant,
        "size_qualifier": size_qualifier,
        "applies_to_all_species": applies_to_all_species,
    }


ADVISORY_SEGMENTS = [
    {
        "id": "shenandoah-pcb-lower-reaches",
        "waterbody": "Lower South Fork, lower North Fork, and main-stem Shenandoah River",
        "section": "South Fork downstream from the Route 619 bridge near Front Royal to the confluence; North Fork from its mouth upstream to Riverton Dam; and the Shenandoah from the fork confluence to the Virginia/West Virginia line.",
        "contaminants": ["PCBs"],
        "location_ids": SHENANDOAH_PCB_IDS,
        "source_url": VDH_SHENANDOAH_2025,
        "source_version": "Current VDH Shenandoah basin sheet · 2025",
        "restrictions": [
            restriction("shen-pcb-carp", "do-not-eat", "Do not eat", "Carp", ["common-carp"], "PCBs"),
            restriction("shen-pcb-channel-cat", "do-not-eat", "Do not eat", "Channel Catfish", ["channel-catfish"], "PCBs"),
            restriction("shen-pcb-white-sucker", "do-not-eat", "Do not eat", "White Sucker", [], "PCBs"),
            restriction("shen-pcb-rock-bass", "two-meals-per-month", "No more than 2 meals/month", "Rock Bass", [], "PCBs"),
            restriction("shen-pcb-sunfish", "two-meals-per-month", "No more than 2 meals/month", "Sunfish", ["bluegill", "redbreast-sunfish"], "PCBs"),
            restriction("shen-pcb-smallmouth", "two-meals-per-month", "No more than 2 meals/month", "Smallmouth Bass", ["smallmouth-bass"], "PCBs"),
            restriction("shen-pcb-largemouth", "two-meals-per-month", "No more than 2 meals/month", "Largemouth Bass", ["largemouth-bass"], "PCBs"),
        ],
    },
    {
        "id": "shenandoah-mercury",
        "waterbody": "South Fork, lower North Fork, and upper main-stem Shenandoah River",
        "section": "South Fork from Port Republic to the fork confluence; North Fork from its mouth upstream to Riverton Dam; and the Shenandoah from the fork confluence to Warren Power Dam.",
        "contaminants": ["Mercury"],
        "location_ids": SHENANDOAH_MERCURY_IDS,
        "source_url": VDH_SHENANDOAH_2025,
        "source_version": "Current VDH Shenandoah basin sheet · 2025",
        "restrictions": [restriction("shen-mercury-all", "two-meals-per-month", "No more than 2 meals/month", "All species", [], "Mercury", applies_to_all_species=True)],
    },
    {
        "id": "potomac-tidal-tributaries-pcb",
        "waterbody": "Tidal Potomac tributaries and embayments",
        "section": "Named tidal tributaries and embayments between the I-395 bridge and the Route 301 Potomac River bridge, including Pohick Creek and the Occoquan River system.",
        "contaminants": ["PCBs"],
        "location_ids": POTOMAC_TIDAL_TRIBUTARY_IDS,
        "source_url": VDH_POTOMAC_2026,
        "source_version": "Current VDH Potomac basin sheet · 2026",
        "restrictions": [
            restriction("potomac-pcb-carp", "do-not-eat", "Do not eat", "Carp", ["common-carp"], "PCBs"),
            restriction("potomac-pcb-eel", "do-not-eat", "Do not eat", "American Eel", [], "PCBs"),
            restriction("potomac-pcb-channel-large", "do-not-eat", "Do not eat", "Channel Catfish", ["channel-catfish"], "PCBs", size_qualifier="18 inches or longer"),
            restriction("potomac-pcb-channel-small", "two-meals-per-month", "No more than 2 meals/month", "Channel Catfish", ["channel-catfish"], "PCBs", size_qualifier="shorter than 18 inches"),
            restriction("potomac-pcb-bullhead", "two-meals-per-month", "No more than 2 meals/month", "Bullhead Catfish", [], "PCBs"),
            restriction("potomac-pcb-largemouth", "two-meals-per-month", "No more than 2 meals/month", "Largemouth Bass", ["largemouth-bass"], "PCBs"),
            restriction("potomac-pcb-striped", "two-meals-per-month", "No more than 2 meals/month", "Anadromous Striped Bass", ["striped-bass"], "PCBs"),
            restriction("potomac-pcb-sunfish", "two-meals-per-month", "No more than 2 meals/month", "Sunfish species", ["bluegill", "redbreast-sunfish"], "PCBs"),
            restriction("potomac-pcb-smallmouth", "two-meals-per-month", "No more than 2 meals/month", "Smallmouth Bass", ["smallmouth-bass"], "PCBs"),
            restriction("potomac-pcb-white-perch", "two-meals-per-month", "No more than 2 meals/month", "White Perch", ["white-perch"], "PCBs"),
            restriction("potomac-pcb-yellow-perch", "two-meals-per-month", "No more than 2 meals/month", "Yellow Perch", ["yellow-perch"], "PCBs"),
        ],
    },
    {
        "id": "occoquan-pfos",
        "waterbody": "Occoquan River and Occoquan Reservoir",
        "section": "The tidal Occoquan below the reservoir dam through Occoquan Bay and Belmont Bay, plus the reservoir from the named backwater boundaries to the Fairfax Water supply dam.",
        "contaminants": ["PFOS"],
        "location_ids": OCCOQUAN_ADVISORY_IDS,
        "source_url": VDH_POTOMAC_2026,
        "source_version": "Current VDH Potomac basin sheet · 2026",
        "restrictions": [
            restriction("occoquan-pfos-largemouth", "do-not-eat", "Do not eat", "Largemouth Bass", ["largemouth-bass"], "PFOS"),
            restriction("occoquan-pfos-bluegill", "two-meals-per-month", "No more than 2 meals/month", "Bluegill Sunfish", ["bluegill"], "PFOS"),
        ],
    },
]


def consumption_advisory(location_record: dict) -> dict:
    common = {
        "source_name": "Virginia Department of Health",
        "source_url": VDH_ADVISORY_SOURCE,
        "reviewed": "2026-07-13",
    }
    waterbody = location_record["waterbody"]
    location_id = location_record["id"]

    segments = [segment for segment in ADVISORY_SEGMENTS if location_id in segment["location_ids"]]
    if segments:
        serialized_segments = [{**segment, "location_ids": sorted(segment["location_ids"])} for segment in segments]
        matching_restrictions = [rule for segment in serialized_segments for rule in segment["restrictions"]]
        return {
            **common,
            "status": "active",
            "label": "VDH consumption restrictions",
            "summary": f"{len(segments)} current VDH advisory segment{' applies' if len(segments) == 1 else 's apply'} at this access point. Restrictions depend on species and sometimes fish length.",
            "contaminants": sorted({contaminant for segment in segments for contaminant in segment["contaminants"]}),
            "segments": serialized_segments,
            "matching_restrictions": matching_restrictions,
            "selected_species_ids": [],
        }
    if waterbody == "Potomac River" or location_id in BOUNDARY_CHECK_IDS:
        return {
            **common,
            "status": "jurisdiction-check",
            "label": "Check advisory boundary" if location_id == "occoquan-hand-carry" else "Check exact jurisdiction",
            "summary": "Confirm the exact catch location against the current jurisdiction and VDH segment before keeping fish.",
            "contaminants": [],
            "segments": [],
            "matching_restrictions": [],
            "selected_species_ids": [],
        }
    return {
        **common,
        "status": "no-advisory-found",
        "label": "No VDH advisory match found",
        "summary": "No matching location was found in the current VDH table during this review. That is not a guarantee that fish are safe to eat.",
        "contaminants": [],
        "segments": [],
        "matching_restrictions": [],
        "selected_species_ids": [],
    }


for location_record in LOCATIONS:
    location_record["consumption_advisory"] = consumption_advisory(location_record)
