from __future__ import annotations

from datetime import datetime, timezone

from .base import JsonProvider


class DwrProvider(JsonProvider):
    provider_name = "Virginia DWR ArcGIS"
    access_endpoint = "https://services.dwr.virginia.gov/arcgis/rest/services/Public/BoatingAccessSites/FeatureServer/0/query"

    async def get_access_locations(self, counties: list[str] | None = None) -> dict:
        where = "1=1"
        if counties:
            safe = [name.replace("'", "''") for name in counties]
            where = "COUNTY in (" + ",".join(f"'{name}'" for name in safe) + ")"
        data = await self.request_json(
            self.access_endpoint,
            params={
                "where": where,
                "outFields": "OBJECTID,SITENAME,WATERBODY,BODYOFWATE,COUNTY,ACCESSAREA,Lat,Long,last_edited_date",
                "returnGeometry": "false",
                "f": "json",
            },
        )
        return {
            "provider": self.provider_name,
            "retrieved_at": datetime.now(timezone.utc).isoformat(),
            "records": [feature.get("attributes", {}) for feature in data.get("features", [])],
        }

