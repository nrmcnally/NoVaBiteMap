"""ORM -> API dict serializers. Response payloads are camelCase for the frontend."""
from __future__ import annotations

from collections import defaultdict

from ..models.entities import (
    FishingLocationRecord,
    LocationStationAssociation,
    SpeciesEvidenceRecord,
    SpeciesRecord,
    StockingRecord,
)


def species_out(record: SpeciesRecord) -> dict:
    return {
        "id": record.id,
        "name": record.common_name,
        "scientificName": record.scientific_name,
        "code": record.species_code,
        "habitat": record.habitat,
        "aliases": record.aliases or [],
    }


_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

_DIEL_TEXT = {
    "crepuscular": "Most active in low light at dawn and dusk; slower under bright midday sun.",
    "nocturnal": "Feeds most actively after dark; slowest during bright midday.",
    "diurnal": "Active through the day, strongest in morning and evening.",
    "flexible": "Feeds across the day with a mild dawn and dusk edge.",
}


def _month_ranges(months: list[int]) -> str:
    if not months:
        return ""
    months = sorted(set(m for m in months if 1 <= m <= 12))
    groups: list[list[int]] = []
    for m in months:
        if groups and m == groups[-1][-1] + 1:
            groups[-1].append(m)
        else:
            groups.append([m])
    parts = []
    for g in groups:
        parts.append(_MONTHS[g[0] - 1] if len(g) == 1 else f"{_MONTHS[g[0] - 1]}–{_MONTHS[g[-1] - 1]}")
    return ", ".join(parts)


def fish_facts(profile: dict | None, species: SpeciesRecord | None) -> dict | None:
    """Compact, display-ready fish facts derived from the researched scoring profile.

    Powers both the expandable spot-level drawer and the /fish/[id] page.
    """
    if not profile:
        return None
    seasonal = profile.get("seasonalActivityByMonth") or []
    peak_months = []
    if seasonal:
        threshold = max(seasonal) * 0.85
        peak_months = [i + 1 for i, v in enumerate(seasonal) if v >= threshold]
    diel = profile.get("dielPattern", "flexible")
    return {
        "preferredTempF": [profile.get("preferredMinF"), profile.get("preferredMaxF")],
        "toleranceTempF": [profile.get("toleranceMinF"), profile.get("toleranceMaxF")],
        "typicalSizeInches": [profile.get("typicalMinInches"), profile.get("typicalMaxInches")],
        "citationLengthInches": profile.get("citationLengthInches"),
        "citationWeightLb": profile.get("citationWeightLb"),
        "identification": profile.get("identification"),
        "baits": profile.get("baits") or [],
        "dielPattern": diel,
        "biteTimes": _DIEL_TEXT.get(diel, _DIEL_TEXT["flexible"]),
        "spawnMonths": profile.get("spawnMonths") or [],
        "spawnWindow": _month_ranges(profile.get("spawnMonths") or []),
        "spawnTempF": profile.get("spawnTempF"),
        "seasonalPeak": _month_ranges(peak_months),
        "habitat": species.habitat if species else None,
        "techniquesBySeason": profile.get("primaryTechniquesBySeason") or {},
        "waterbodyPreference": profile.get("waterbodyPreference") or {},
        "confidence": profile.get("confidence"),
        "sources": profile.get("sourceUrls") or [],
        "notes": profile.get("notes"),
    }


def evidence_out(record: SpeciesEvidenceRecord) -> dict:
    return {
        "speciesId": record.species_id,
        "evidenceType": record.evidence_type,
        "presenceStatus": record.presence_status,
        "modeled": record.modeled,
        "availability": record.availability,
        "quality": record.quality,
        "evidenceConfidence": record.evidence_confidence,
        "evidenceSummary": record.evidence_summary,
        "lastEvidence": record.last_evidence,
        "technique": record.technique,
        "depth": record.depth,
        "positive": record.positive or [],
        "negative": record.negative or [],
        "sourceName": record.source_name,
        "sourceUrl": record.source_url,
    }


def stocking_out(record: StockingRecord | None) -> dict | None:
    if record is None:
        return None
    return {
        "category": record.category,
        "designation": record.designation,
        "speciesIds": record.species_ids or [],
        "sourceUrl": record.source_url,
        "planUrl": record.plan_url,
        "reviewed": record.reviewed,
    }


def association_out(assoc: LocationStationAssociation | None, station_name: str | None = None) -> dict | None:
    if assoc is None:
        return None
    return {
        "stationId": assoc.station_id,
        "stationName": station_name,
        "associationType": assoc.relationship_type,
        "associationFactor": assoc.association_factor,
        "basis": assoc.basis,
        "limitation": assoc.limitation,
        "verified": assoc.verified,
    }


def location_summary(record: FishingLocationRecord) -> dict:
    evidence_species = sorted({e.species_id for e in record.evidence})
    advisory = (record.details or {}).get("consumptionAdvisory") or {}
    return {
        "id": record.id,
        "name": record.name,
        "waterbody": record.waterbody,
        "waterbodyType": record.waterbody_type,
        "county": record.county,
        "watershed": record.watershed,
        "lat": record.latitude,
        "lng": record.longitude,
        "distanceMiles": record.distance_miles,
        "travelMinutes": record.travel_minutes,
        "publicAccess": record.public_access,
        "accessStatus": record.access_status,
        "access": record.access_methods or [],
        "aliases": [a.alias for a in record.aliases],
        "bestWindow": record.best_window,
        "activityEstimate": record.activity_estimate,
        "hasEvidence": bool(record.evidence),
        "evidenceSpeciesIds": evidence_species,
        "consumptionAdvisoryStatus": advisory.get("status"),
        "sourceName": record.access_authority,
        "sourceUrl": record.access_source_url,
    }


def location_detail(
    record: FishingLocationRecord,
    *,
    stocking: StockingRecord | None,
    association: LocationStationAssociation | None,
    station_name: str | None,
) -> dict:
    grouped: dict[str, list[SpeciesEvidenceRecord]] = defaultdict(list)
    for ev in record.evidence:
        grouped[ev.species_id].append(ev)
    return {
        "id": record.id,
        "name": record.name,
        "waterbody": record.waterbody,
        "waterbodyType": record.waterbody_type,
        "county": record.county,
        "watershed": record.watershed,
        "state": record.state,
        "lat": record.latitude,
        "lng": record.longitude,
        "distanceMiles": record.distance_miles,
        "travelMinutes": record.travel_minutes,
        "publicAccess": record.public_access,
        "accessStatus": record.access_status,
        "access": record.access_methods or [],
        "aliases": [a.alias for a in record.aliases],
        "notice": record.notice,
        "flowStatus": record.flow_status,
        "activityEstimate": record.activity_estimate,
        "accessFit": record.access_fit,
        "bestWindow": record.best_window,
        "accessAuthority": record.access_authority,
        "accessSourceUrl": record.access_source_url,
        "sourceReviewed": record.source_reviewed,
        "evidence": [evidence_out(ev) for ev in record.evidence],
        "evidenceSpeciesIds": sorted(grouped.keys()),
        "stocking": stocking_out(stocking),
        "hydrology": association_out(association, station_name),
        "consumptionAdvisory": (record.details or {}).get("consumptionAdvisory"),
    }
