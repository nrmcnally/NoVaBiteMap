from __future__ import annotations

import pathlib
import sys

from sqlalchemy import func, select

API_ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(API_ROOT))


def test_seed_counts_match_audited_dataset(seeded_db):
    from app.core.database import SessionLocal
    from app.models.entities import (
        FishingLocationRecord,
        LocationStationAssociation,
        SpeciesEvidenceRecord,
        SpeciesRecord,
        SpeciesScoringProfile,
        StockingRecord,
    )

    with SessionLocal() as s:
        assert s.scalar(select(func.count()).select_from(FishingLocationRecord)) == 196
        assert s.scalar(select(func.count()).select_from(SpeciesRecord)) == 37
        assert s.scalar(select(func.count()).select_from(SpeciesEvidenceRecord)) == 1427
        assert s.scalar(select(func.count()).select_from(SpeciesScoringProfile)) == 20
        assert s.scalar(select(func.count()).select_from(StockingRecord)) == 13
        assert s.scalar(select(func.count()).select_from(LocationStationAssociation)) == 19
        # 168 of 196 waters carry evidence; the rest honestly have none (the retired
        # county/basin guess used to fill all 196).
        assert s.scalar(select(func.count(func.distinct(SpeciesEvidenceRecord.location_id)))) == 168


def test_reseed_is_idempotent(seeded_db):
    from app.data.loader import load_seed

    result = load_seed()  # not forced: unchanged checksum -> skipped
    assert result.status == "skipped"
    assert result.records_created == 0


def test_modeled_evidence_flagged_and_records_a_run(seeded_db):
    from app.core.database import SessionLocal
    from app.models.entities import DataIngestionRun, SpeciesEvidenceRecord

    with SessionLocal() as s:
        modeled = s.scalar(
            select(func.count()).select_from(SpeciesEvidenceRecord).where(SpeciesEvidenceRecord.modeled == True)  # noqa: E712
        )
        assert modeled == 325
        runs = s.scalars(select(DataIngestionRun)).all()
        assert any(r.status == "success" for r in runs)
        assert all(r.checksum for r in runs if r.status == "success")


def test_watershed_tagging_covers_major_basins(seeded_db):
    from app.core.database import SessionLocal
    from app.models.entities import FishingLocationRecord

    with SessionLocal() as s:
        rows = s.execute(
            select(FishingLocationRecord.watershed, func.count()).group_by(FishingLocationRecord.watershed)
        ).all()
        watersheds = {w: c for w, c in rows if w}
        assert "Potomac" in watersheds
        assert "Shenandoah" in watersheds
        assert "Occoquan" in watersheds
