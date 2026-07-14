from __future__ import annotations

import json
import logging
import time
from typing import Any

from .config import settings

logger = logging.getLogger("bitemap.cache")

# Optional dependency: if redis is installed and reachable we use it, otherwise
# every operation transparently falls back to an in-process TTL dict. This keeps
# the app fully functional with no Redis (graceful degradation) while still
# honouring a shared cache in the composed deployment.
try:  # pragma: no cover - import guard
    import redis.asyncio as aioredis
except Exception:  # pragma: no cover
    aioredis = None


class Cache:
    def __init__(self) -> None:
        self._local: dict[str, tuple[float, Any]] = {}
        self._redis = None
        self._redis_failed = False

    async def _client(self):
        if aioredis is None or not settings.redis_url or self._redis_failed:
            return None
        if self._redis is None:
            try:
                self._redis = aioredis.from_url(
                    settings.redis_url, encoding="utf-8", decode_responses=True
                )
            except Exception as error:  # pragma: no cover - depends on environment
                logger.info("Redis unavailable, using in-process cache: %s", error)
                self._redis_failed = True
                return None
        return self._redis

    async def get_json(self, key: str) -> Any | None:
        client = await self._client()
        if client is not None:
            try:
                raw = await client.get(key)
                return json.loads(raw) if raw is not None else None
            except Exception as error:  # pragma: no cover
                logger.info("Redis get failed, falling back: %s", error)
                self._redis_failed = True
        entry = self._local.get(key)
        if not entry:
            return None
        expires_at, value = entry
        if expires_at < time.monotonic():
            self._local.pop(key, None)
            return None
        return value

    async def set_json(self, key: str, value: Any, ttl: int | None = None) -> None:
        ttl = ttl if ttl is not None else settings.cache_ttl_seconds
        client = await self._client()
        if client is not None:
            try:
                await client.set(key, json.dumps(value), ex=ttl)
                return
            except Exception as error:  # pragma: no cover
                logger.info("Redis set failed, falling back: %s", error)
                self._redis_failed = True
        self._local[key] = (time.monotonic() + ttl, value)

    @property
    def backend(self) -> str:
        return "redis" if (self._redis is not None and not self._redis_failed) else "in-process"


cache = Cache()
