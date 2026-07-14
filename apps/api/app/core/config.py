from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    app_name: str = "BiteMap NOVA API"
    api_prefix: str = "/api"
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./bitemap.db")
    redis_url: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    nws_user_agent: str = os.getenv(
        "NWS_USER_AGENT", "BiteMap-NOVA/0.1 (contact: admin@example.com)"
    )
    request_timeout_seconds: float = float(os.getenv("REQUEST_TIMEOUT_SECONDS", "10"))
    session_hours: int = int(os.getenv("SESSION_HOURS", "168"))


settings = Settings()

