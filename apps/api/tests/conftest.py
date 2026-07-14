from __future__ import annotations

import os
import pathlib
import sys
import tempfile

import pytest

API_ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(API_ROOT))

# Isolate every test run in a throwaway SQLite database *before* app import so the
# module-level engine binds to it.
_TMP_DB = pathlib.Path(tempfile.gettempdir()) / "bitemap_test.db"
if _TMP_DB.exists():
    _TMP_DB.unlink()
os.environ["DATABASE_URL"] = f"sqlite:///{_TMP_DB.as_posix()}"
os.environ.setdefault("REDIS_URL", "")  # force in-process cache fallback in tests


@pytest.fixture(scope="session")
def seeded_db():
    from app.core.database import Base, engine
    from app import models  # noqa: F401
    from app.data.loader import load_seed

    Base.metadata.create_all(engine)
    result = load_seed(force=True)
    assert result.status == "success", f"seed failed: {result}"
    yield result


@pytest.fixture(scope="session")
def client(seeded_db):
    from fastapi.testclient import TestClient
    from app.main import app

    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture()
def auth_client(client):
    """A TestClient wrapper that registers a fresh user and sets the bearer token."""
    import uuid

    email = f"angler-{uuid.uuid4().hex[:8]}@example.com"
    resp = client.post("/api/auth/register", json={"email": email, "password": "correcthorsebattery"})
    assert resp.status_code == 201, resp.text
    token = resp.json()["access_token"]

    class Authed:
        def __init__(self, base, token):
            self._base = base
            self._headers = {"Authorization": f"Bearer {token}"}

        def get(self, url, **kwargs):
            return self._base.get(url, headers=self._headers, **kwargs)

        def post(self, url, **kwargs):
            return self._base.post(url, headers=self._headers, **kwargs)

        def patch(self, url, **kwargs):
            return self._base.patch(url, headers=self._headers, **kwargs)

        def delete(self, url, **kwargs):
            return self._base.delete(url, headers=self._headers, **kwargs)

    return Authed(client, token)
