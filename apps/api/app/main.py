from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.routes import router
from .core.config import settings
from .core.database import Base, engine
from . import models  # noqa: F401 - registers ORM metadata


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Convenient SQLite bootstrap for local development. Production uses Alembic.
    if settings.database_url.startswith("sqlite"):
        Base.metadata.create_all(engine)
    yield


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="Evidence-led Northern Virginia fishing opportunity API. Scores are not catch probabilities.",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)
app.include_router(router, prefix=settings.api_prefix)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": settings.app_name, "version": "0.1.0"}

