from __future__ import annotations

import os
from dataclasses import dataclass, field


def _origins() -> list[str]:
    raw = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:3001")
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


@dataclass(frozen=True)
class Settings:
    app_name: str = "BiteMap NOVA API"
    api_prefix: str = "/api"
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./bitemap.db")
    # Redis is optional: the cache degrades to an in-process TTL store when unset
    # or unreachable, so the app runs without it (graceful degradation).
    redis_url: str | None = os.getenv("REDIS_URL") or None
    cache_ttl_seconds: int = int(os.getenv("CACHE_TTL_SECONDS", "900"))
    nws_user_agent: str = os.getenv(
        "NWS_USER_AGENT", "BiteMap-NOVA/0.2 (contact: admin@example.com)"
    )
    request_timeout_seconds: float = float(os.getenv("REQUEST_TIMEOUT_SECONDS", "10"))
    session_hours: int = int(os.getenv("SESSION_HOURS", "168"))
    cors_origins: list[str] = field(default_factory=_origins)


settings = Settings()
