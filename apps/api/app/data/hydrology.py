from __future__ import annotations


STATIONS = {
    "01629500": "South Fork Shenandoah River near Luray, VA",
    "01631000": "South Fork Shenandoah River at Front Royal, VA",
    "01634000": "North Fork Shenandoah River near Strasburg, VA",
    "01636500": "Shenandoah River at Millville, WV",
    "01638500": "Potomac River at Point of Rocks, MD",
    "01646500": "Potomac River near Washington, DC",
    "01656703": "Occoquan Reservoir above Bull Run near Clifton, VA",
}

def association(station_id: str, association_type: str) -> dict:
    return {
        "station_id": station_id,
        "station_name": STATIONS[station_id],
        "association_type": association_type,
        "association_factor": 1.0 if association_type == "same-waterbody" else 0.85,
        "monitor_url": f"https://waterdata.usgs.gov/monitoring-location/USGS-{station_id}/",
    }


HYDROLOGY_ASSOCIATIONS = {
    "front-royal": association("01631000", "same-waterbody"),
    "karo": association("01631000", "connected-reach"),
    "simpsons": association("01631000", "connected-reach"),
    "bentonville": association("01629500", "connected-reach"),
    "catletts-ford": association("01634000", "connected-reach"),
    "riverton": association("01634000", "connected-reach"),
    "morgans-ford": association("01636500", "connected-reach"),
    "berrys": association("01636500", "connected-reach"),
    "castlemans-ferry": association("01636500", "connected-reach"),
    "lockes": association("01636500", "connected-reach"),
    "point-of-rocks": association("01638500", "same-waterbody"),
    "piscataway-crossing": association("01638500", "connected-reach"),
    "great-falls": association("01646500", "connected-reach"),
    "riverbend-park": association("01646500", "connected-reach"),
    "seneca-regional": association("01646500", "connected-reach"),
    "algonkian": association("01646500", "connected-reach"),
    "fountainhead": association("01656703", "connected-reach"),
    "bull-run-marina": association("01656703", "connected-reach"),
    "lake-ridge-marina": association("01656703", "connected-reach"),
}
