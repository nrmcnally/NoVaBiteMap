from __future__ import annotations

from datetime import datetime, timezone

from .base import JsonProvider, ProviderError
from ..core.config import settings


class NwsProvider(JsonProvider):
    provider_name = "National Weather Service"
    base_url = "https://api.weather.gov"

    @property
    def headers(self) -> dict:
        return {"Accept": "application/geo+json", "User-Agent": settings.nws_user_agent}

    async def get_hourly_forecast(self, latitude: float, longitude: float) -> dict:
        points = await self.request_json(f"{self.base_url}/points/{latitude:.4f},{longitude:.4f}", headers=self.headers)
        hourly_url = points.get("properties", {}).get("forecastHourly")
        if not hourly_url:
            raise ProviderError("NWS points response lacks forecastHourly")
        forecast = await self.request_json(hourly_url, headers=self.headers)
        periods = forecast.get("properties", {}).get("periods", [])
        return {
            "provider": self.provider_name,
            "retrieved_at": datetime.now(timezone.utc).isoformat(),
            "forecast_updated_at": forecast.get("properties", {}).get("updated"),
            "periods": periods,
            "observed": False,
        }

    async def get_alerts(self, latitude: float, longitude: float) -> dict:
        return await self.request_json(
            f"{self.base_url}/alerts/active", params={"point": f"{latitude:.4f},{longitude:.4f}"}, headers=self.headers
        )

