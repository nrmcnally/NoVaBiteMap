from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
from pathlib import Path
from typing import Any


AQUATIC_GAP_RELEASE = {
    "dataset": "Presence Absence Database of Fish in the Conterminous United States",
    "version": "2.0 (December 2024)",
    "doi": "10.5066/P9FZ6J6R",
    "dataset_md5": "e80c0a914746b7df38401e15b8cb2504",
    "species_md5": "4d16c6c3ef657bda84d8035a44ada262",
}

# HUC8 subbasins our locations actually fall in (verified via USGS WBD point lookup).
# Beyond the original Potomac/Shenandoah set, this now includes the Rappahannock/
# Rapidan (2080103/04), Monocacy (2070011), and adjacent subbasins so waters in
# those drainages get real presence/absence records instead of a county guess.
TARGET_HUCS = {
    "2070004", "2070005", "2070006", "2070007", "2070008", "2070010", "2070011",
    "2080103", "2080104", "2080106",
}
TARGET_COUNTIES = {
    "Fairfax",
    "Fauquier",
    "Frederick",
    "Loudoun",
    "Page",
    "Prince William",
    "Rappahannock",
    "Shenandoah",
    "Warren",
}

# Target gamefish/panfish (people fish for these).
SPECIES_BY_SCIENTIFIC_NAME = {
    "Micropterus dolomieu": "smallmouth-bass",
    "Micropterus salmoides": "largemouth-bass",
    "Micropterus punctulatus": "spotted-bass",
    "Ambloplites rupestris": "rock-bass",
    "Lepomis macrochirus": "bluegill",
    "Lepomis auritus": "redbreast-sunfish",
    "Lepomis gibbosus": "pumpkinseed",
    "Lepomis cyanellus": "green-sunfish",
    "Lepomis gulosus": "warmouth",
    "Pomoxis nigromaculatus": "black-crappie",
    "Pomoxis annularis": "white-crappie",
    "Ictalurus punctatus": "channel-catfish",
    "Ictalurus furcatus": "blue-catfish",
    "Pylodictis olivaris": "flathead-catfish",
    "Oncorhynchus mykiss": "rainbow-trout",
    "Salmo trutta": "brown-trout",
    "Salvelinus fontinalis": "brook-trout",
    "Sander vitreus": "walleye",
    "Perca flavescens": "yellow-perch",
    "Morone americana": "white-perch",
    "Morone saxatilis": "striped-bass",
    "Esox masquinongy": "muskellunge",
    # Non-game / forage species. Recorded by the same surveys; surfaced as cited
    # presence-only context (never scored as targets). Honest breadth for small
    # streams whose only documented fish are forage species.
    "Semotilus atromaculatus": "creek-chub",
    "Semotilus corporalis": "fallfish",
    "Rhinichthys atratulus": "blacknose-dace",
    "Rhinichthys cataractae": "longnose-dace",
    "Catostomus commersonii": "white-sucker",
    "Hypentelium nigricans": "northern-hogsucker",
    "Etheostoma olmstedi": "tessellated-darter",
    "Anguilla rostrata": "american-eel",
    "Cottus bairdii": "mottled-sculpin",
    "Moxostoma macrolepidotum": "shorthead-redhorse",
    "Ameiurus natalis": "yellow-bullhead",
    "Ameiurus nebulosus": "brown-bullhead",
    "Dorosoma cepedianum": "gizzard-shad",
}

# Which of the above are non-game/forage (presence-only downstream).
NON_GAME_SPECIES_IDS = {
    "creek-chub", "fallfish", "blacknose-dace", "longnose-dace", "white-sucker",
    "northern-hogsucker", "tessellated-darter", "american-eel", "mottled-sculpin",
    "shorthead-redhorse", "yellow-bullhead", "brown-bullhead", "gizzard-shad",
}


def md5(path: Path) -> str:
    digest = hashlib.md5(usedforsecurity=False)
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def verify(path: Path, expected: str) -> None:
    actual = md5(path)
    if actual != expected:
        raise ValueError(f"Checksum mismatch for {path.name}: expected {expected}, got {actual}")


def import_aquatic_gap(dataset_path: Path, species_path: Path) -> dict[str, Any]:
    verify(dataset_path, AQUATIC_GAP_RELEASE["dataset_md5"])
    verify(species_path, AQUATIC_GAP_RELEASE["species_md5"])

    tsn_to_species: dict[str, str] = {}
    with species_path.open(newline="", encoding="utf-8-sig") as source:
        for row in csv.DictReader(source):
            species_id = SPECIES_BY_SCIENTIFIC_NAME.get(row["scientific_name"])
            if species_id:
                tsn_to_species[row["itis_tsn"]] = species_id

    samples: list[dict[str, Any]] = []
    with dataset_path.open(newline="", encoding="utf-8-sig") as source:
        for row in csv.DictReader(source):
            if row["huc8"] not in TARGET_HUCS:
                continue
            present = [species_id for tsn, species_id in tsn_to_species.items() if row.get(tsn) == "1"]
            absent = [species_id for tsn, species_id in tsn_to_species.items() if row.get(tsn) == "0"]
            samples.append(
                {
                    "comid": int(row["comid"]),
                    "huc8": row["huc8"].zfill(8),
                    "latitude": round(float(row["latitude"]), 7),
                    "longitude": round(float(row["longitude"]), 7),
                    "source": row["source"],
                    "sampleDate": sample_date(row),
                    "presentSpeciesIds": sorted(present),
                    "absentSpeciesIds": sorted(absent),
                }
            )

    return {
        "release": AQUATIC_GAP_RELEASE,
        "scope": {
            "huc8": sorted(huc.zfill(8) for huc in TARGET_HUCS),
            "speciesCount": len(tsn_to_species),
            "sampleCount": len(samples),
            "nonGameSpeciesIds": sorted(NON_GAME_SPECIES_IDS),
        },
        "samples": samples,
    }


def sample_date(row: dict[str, str]) -> str:
    year = int(float(row["sample_year"]))
    month = int(float(row["sample_month"])) if row.get("sample_month") else 1
    day = int(float(row["sample_day"])) if row.get("sample_day") else 1
    return f"{year:04d}-{month:02d}-{day:02d}"


def longest_path(geometry: dict[str, Any]) -> list[list[float]]:
    coordinates = geometry.get("coordinates", [])
    if geometry.get("type") == "LineString":
        return coordinates
    if geometry.get("type") == "MultiLineString":
        return max(coordinates, key=len, default=[])
    return []


def line_midpoint(path: list[list[float]]) -> tuple[float, float]:
    if not path:
        raise ValueError("DWR trout feature has no line coordinates")
    if len(path) == 1:
        return path[0][0], path[0][1]

    lengths: list[float] = []
    total = 0.0
    for start, end in zip(path, path[1:]):
        length = math.hypot(end[0] - start[0], end[1] - start[1])
        lengths.append(length)
        total += length
    target = total / 2
    traversed = 0.0
    for index, length in enumerate(lengths):
        if traversed + length >= target:
            ratio = 0 if length == 0 else (target - traversed) / length
            start, end = path[index], path[index + 1]
            return start[0] + ratio * (end[0] - start[0]), start[1] + ratio * (end[1] - start[1])
        traversed += length
    return path[-1][0], path[-1][1]


def import_dwr_trout(geojson_path: Path) -> dict[str, Any]:
    payload = json.loads(geojson_path.read_text(encoding="utf-8-sig"))
    waters: list[dict[str, Any]] = []
    for feature in payload.get("features", []):
        properties = feature.get("properties", {})
        schedule = properties.get("StockSched") or ""
        county = properties.get("County") or ""
        if county not in TARGET_COUNTIES or schedule not in {"A", "B", "C", "CR", "DH", "U"}:
            continue
        longitude, latitude = line_midpoint(longest_path(feature.get("geometry", {})))
        species_ids = [
            species_id
            for field, species_id in (
                ("RainbowTrout", "rainbow-trout"),
                ("BrownTrout", "brown-trout"),
                ("BrookTrout", "brook-trout"),
            )
            if properties.get(field) == 1
        ]
        waters.append(
            {
                "id": f"dwr-trout-{properties['OBJECTID']}",
                "objectId": properties["OBJECTID"],
                "name": properties["Waterbody"],
                "county": county,
                "latitude": round(latitude, 7),
                "longitude": round(longitude, 7),
                "stockingCategory": schedule,
                "designation": properties.get("Designation") or schedule,
                "speciesIds": species_ids,
                "notes": (properties.get("Notes") or "").strip() or None,
                "heritageDay": properties.get("HeritageDay") == 1,
                "nationalForest": properties.get("NationalForest") == 1,
                "noFallStock": properties.get("NoFallStock") == 1,
                "sourceUrl": (
                    properties.get("TroutAppLinkUrl")
                    or properties.get("StockingUrl")
                    or "https://dwr.virginia.gov/fishing/trout/"
                ).replace("http://", "https://", 1),
            }
        )

    return {
        "release": {
            "dataset": "Virginia DWR Designated Stocked Trout Waters",
            "service": "VAFWIS/Stocked_Trout_Waters",
            "reviewed": "2026-07-14",
            "sourceUrl": "https://services.dwr.virginia.gov/arcgis/rest/services/VAFWIS/Stocked_Trout_Waters/FeatureServer/0",
            "planUrl": "https://dwr.virginia.gov/wp-content/uploads/media/catchable-trout-stocking-plan.pdf",
        },
        "scope": {"counties": sorted(TARGET_COUNTIES), "waterCount": len(waters)},
        "waters": sorted(waters, key=lambda item: (item["county"], item["name"], item["id"])),
    }


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, sort_keys=False) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Normalize official public fisheries datasets for BiteMap NOVA")
    parser.add_argument("--agap-data", type=Path, required=True)
    parser.add_argument("--agap-species", type=Path, required=True)
    parser.add_argument("--trout-geojson", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()

    write_json(args.output_dir / "aquatic-gap-nova.json", import_aquatic_gap(args.agap_data, args.agap_species))
    write_json(args.output_dir / "dwr-trout-nova.json", import_dwr_trout(args.trout_geojson))


if __name__ == "__main__":
    main()
