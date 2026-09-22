import os
import uuid

os.environ.setdefault("AUTO_SEED", "false")
os.environ.setdefault("RATE_LIMIT_ENABLED", "false")

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

from app.core.database import Base, get_db, make_engine
from app.main import create_app
from seeds.seed import seed_all


@pytest.fixture()
def engine():
    eng = make_engine("sqlite://")
    import app.models  # noqa: F401

    Base.metadata.create_all(eng)
    yield eng
    eng.dispose()


@pytest.fixture()
def db_session(engine):
    TestSession = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    with TestSession() as s:
        seed_all(s)
    return TestSession


@pytest.fixture()
def client(db_session):
    app = create_app()

    def _override():
        s = db_session()
        try:
            yield s
        finally:
            s.close()

    app.dependency_overrides[get_db] = _override
    with TestClient(app, raise_server_exceptions=True) as c:
        # lifespan runs init_db against the default engine; harmless with AUTO_SEED=false
        yield c


def register(client: TestClient, email: str | None = None, name: str = "Asha") -> dict:
    email = email or f"{uuid.uuid4().hex[:8]}@test.edu"
    r = client.post(
        "/api/v1/auth/register", json={"email": email, "password": "password123", "name": name}
    )
    assert r.status_code == 201, r.text
    return r.json()


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def onboard(client: TestClient, token: str, **overrides) -> dict:
    body = {
        "goal": "general",
        "level": "beginner",
        "minutes_per_session": 15,
        "days_per_week": 4,
        "institute_id": 1,
        "department": "CSE",
        "hostel": "Block C",
        "preferences": {"voice": True},
    }
    body.update(overrides)
    r = client.put("/api/v1/users/me/profile", json=body, headers=auth(token))
    assert r.status_code == 200, r.text
    return r.json()
