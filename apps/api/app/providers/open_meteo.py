from __future__ import annotations

from datetime import datetime, timezone

from .base import JsonProvider, ProviderError


class OpenMeteoAirProvider(JsonProvider):
    """Daily air-temperature history used only by the water-temperature model.

    NWS remains the canonical short-range weather forecast. Open-Meteo supplies
    the multi-week thermal history that NWS does not expose through its forecast
    API. Air temperature is never presented as an observed water temperature.
    """

    provider_name = "Open-Meteo"
    endpoint = "https://api.open-meteo.com/v1/forecast"

    async def get_daily_air_temperatures(
        self,
        latitude: float,
        longitude: float,
        *,
        past_days: int = 45,
        forecast_days: int = 6,
    ) -> dict:
        data = await self.request_json(
            self.endpoint,
            params={
                "latitude": round(latitude, 4),
                "longitude": round(longitude, 4),
                "daily": "temperature_2m_mean",
                "temperature_unit": "celsius",
                "timezone": "America/New_York",
                "past_days": past_days,
                "forecast_days": forecast_days,
            },
        )
        daily = data.get("daily", {})
        dates = daily.get("time") or []
        temperatures = daily.get("temperature_2m_mean") or []
        if not dates or len(dates) != len(temperatures):
            raise ProviderError("Open-Meteo daily air-temperature response is incomplete")

        days = []
        for date, temperature in zip(dates, temperatures, strict=False):
            if temperature is None:
                continue
            try:
                days.append({"date": str(date), "temperatureC": float(temperature)})
            except (TypeError, ValueError):
                continue
        if len(days) < 14:
            raise ProviderError("Open-Meteo returned too little thermal history")

        return {
            "provider": self.provider_name,
            "retrieved_at": datetime.now(timezone.utc).isoformat(),
            "latitude": data.get("latitude", latitude),
            "longitude": data.get("longitude", longitude),
            "days": days,
        }
