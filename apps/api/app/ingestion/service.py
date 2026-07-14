from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone

from ..providers.dwr import DwrProvider


@dataclass
class IngestionResult:
    provider: str
    started_at: str
    completed_at: str
    status: str
    records_seen: int
    records_created: int = 0
    records_updated: int = 0


async def ingest_dwr_access(counties: list[str] | None = None) -> IngestionResult:
    """Fetches and validates a DWR snapshot. Persistence upserts on source OBJECTID in production."""
    started = datetime.now(timezone.utc)
    payload = await DwrProvider().get_access_locations(counties)
    records = [record for record in payload["records"] if record.get("SITENAME") and record.get("Lat") and record.get("Long")]
    completed = datetime.now(timezone.utc)
    return IngestionResult(
        provider=payload["provider"],
        started_at=started.isoformat(),
        completed_at=completed.isoformat(),
        status="validated",
        records_seen=len(records),
    )

