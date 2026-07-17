from __future__ import annotations

from datetime import datetime, timezone

from .base import JsonProvider


class UsgsWaterProvider(JsonProvider):
    provider_name = "USGS Water Services"
    endpoint = "https://waterservices.usgs.gov/nwis/iv/"

    async def get_latest_observations(self, station_id: str) -> dict:
        data = await self.request_json(
            self.endpoint,
            params={
                "format": "json",
                "sites": station_id,
                "parameterCd": "00060,00065,00010,00095,63680,00300",
                "siteStatus": "all",
                "period": "P2D",
            },
        )
        return {
            "provider": self.provider_name,
            "station_id": station_id,
            "retrieved_at": datetime.now(timezone.utc).isoformat(),
            "time_series": data.get("value", {}).get("timeSeries", []),
        }
