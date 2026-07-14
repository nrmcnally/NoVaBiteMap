from __future__ import annotations

import asyncio

import httpx

from ..core.config import settings


class ProviderError(RuntimeError):
    pass


class JsonProvider:
    provider_name = "provider"

    async def request_json(self, url: str, *, params: dict | None = None, headers: dict | None = None) -> dict:
        last_error: Exception | None = None
        timeout = httpx.Timeout(settings.request_timeout_seconds)
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            for attempt in range(3):
                try:
                    response = await client.get(url, params=params, headers=headers)
                    response.raise_for_status()
                    return response.json()
                except (httpx.HTTPError, ValueError) as error:
                    last_error = error
                    if attempt < 2:
                        await asyncio.sleep(0.25 * 2**attempt)
        raise ProviderError(f"{self.provider_name} unavailable: {last_error}")

