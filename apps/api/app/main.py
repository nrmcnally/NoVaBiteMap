from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .api.routes import router
from .core.config import settings
from .core.database import Base, SessionLocal, engine
from . import models  # noqa: F401 - registers ORM metadata

logger = logging.getLogger("bitemap.startup")


@asynccontextmanager
async def lifespan(_: FastAPI):
    # SQLite is the zero-dependency local/dev + test backend; Postgres runs
    # Alembic migrations from the container entrypoint (see apps/api/Dockerfile).
    if settings.database_url.startswith("sqlite"):
        Base.metadata.create_all(engine)
        _seed_if_empty()
    yield


def _seed_if_empty() -> None:
    """Convenience for local SQLite: load the bundled seed export if the DB is empty."""
    from .data.loader import load_seed, seed_export_path
    from .models.entities import FishingLocationRecord

    with SessionLocal() as session:
        already = session.query(FishingLocationRecord).first()
    if already is not None:
        return
    if not seed_export_path().exists():
        logger.warning("No seed_export.json present; database starts empty.")
        return
    try:
        result = load_seed()
        logger.info("Auto-seeded local database: %s locations", result.records_created)
    except Exception as error:  # pragma: no cover - dev convenience only
        logger.warning("Auto-seed skipped: %s", error)


app = FastAPI(
    title=settings.app_name,
    version="0.2.0",
    description="Evidence-led Northern Virginia fishing opportunity API. Scores are not catch probabilities.",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)
app.include_router(router, prefix=settings.api_prefix)


@app.get("/health")
def health() -> dict:
    # A container healthcheck must reflect reality: if migrations ran but the
    # seed failed, the DB is empty and the app would silently serve snapshot
    # fallback. Return 503 so Compose marks the API unhealthy (and the web
    # service does not start against a dataless stack) instead of green-lighting it.
    from .models.entities import FishingLocationRecord

    try:
        with SessionLocal() as session:
            locations = session.query(FishingLocationRecord).count()
    except Exception as error:  # DB unreachable / schema missing
        raise HTTPException(status_code=503, detail=f"Database unavailable: {error}") from error
    if locations <= 0:
        raise HTTPException(status_code=503, detail="Database has no locations (seed did not load)")
    return {"status": "ok", "service": settings.app_name, "version": "0.2.0", "locations": locations}
