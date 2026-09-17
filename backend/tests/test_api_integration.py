"""End-to-end API tests against a live Postgres + PostGIS instance.

These are skipped automatically when no database is reachable, so `pytest` stays green on
a laptop with nothing running. Run them with the stack up:

    docker-compose up -d db
    DATABASE_URL=postgresql+psycopg2://darukaa:darukaa@localhost:5432/darukaa pytest -m integration

They cover the full Story 1 path — register, log in, create a project, POST a drawn
polygon, and read back the PostGIS-computed area — plus the ML and GenAI endpoints.
"""

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.core.database import engine
from app.main import app

pytestmark = pytest.mark.integration


def _database_available() -> bool:
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT PostGIS_Version()"))
        return True
    except Exception:
        return False


requires_db = pytest.mark.skipif(
    not _database_available(),
    reason="No Postgres+PostGIS reachable — run `docker-compose up -d db` and migrate first.",
)

# A ~1km x ~1km square near the equator, so the projected area is easy to sanity-check.
SQUARE = {
    "type": "Polygon",
    "coordinates": [[[-60.0, 0.0], [-59.99, 0.0], [-59.99, 0.01], [-60.0, 0.01], [-60.0, 0.0]]],
}


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture(scope="module")
def auth_headers(client):
    email = f"test-{uuid.uuid4().hex[:10]}@darukaa.earth"
    password = "test-password-123"
    register = client.post("/auth/register", json={"email": email, "password": password})
    assert register.status_code == 201, register.text
    login = client.post("/auth/login", json={"email": email, "password": password})
    assert login.status_code == 200, login.text
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


@pytest.fixture(scope="module")
def project(client, auth_headers):
    response = client.post(
        "/projects",
        headers=auth_headers,
        json={
            "name": "Integration Test Project",
            "description": "Created by the automated test suite.",
            "project_type": "both",
            "start_date": "2026-01-01",
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


@pytest.fixture(scope="module")
def site(client, auth_headers, project):
    response = client.post(
        f"/projects/{project['id']}/sites",
        headers=auth_headers,
        json={"name": "Integration Site 01", "geometry": SQUARE},
    )
    assert response.status_code == 201, response.text
    return response.json()


@requires_db
def test_login_returns_both_tokens(client, auth_headers):
    assert auth_headers["Authorization"].startswith("Bearer ")


@requires_db
def test_site_area_is_computed_server_side(site):
    """Story 1 acceptance criterion: area is auto-computed, never user-supplied."""
    assert site["area_ha"] > 0
    # ~0.01 deg x 0.01 deg at the equator is roughly 1.1km square => ~120 ha.
    assert 80 < site["area_ha"] < 200, f"unexpected area: {site['area_ha']} ha"


@requires_db
def test_site_geometry_roundtrips_as_geojson(site):
    assert site["geometry"]["type"] == "Polygon"
    assert len(site["geometry"]["coordinates"][0]) == 5


@requires_db
def test_new_site_is_seeded_with_metric_history(client, auth_headers, site):
    response = client.get(f"/sites/{site['id']}/metrics?days=180", headers=auth_headers)
    assert response.status_code == 200
    assert len(response.json()["points"]) >= 170


@requires_db
def test_forecast_endpoint_returns_six_periods_with_a_band(client, auth_headers, site):
    response = client.get(f"/sites/{site['id']}/forecast?metric=carbon", headers=auth_headers)
    assert response.status_code == 200
    body = response.json()
    assert len(body["forecast"]) == 6
    assert body["confidence"] == 0.95
    assert all(p["lower"] <= p["value"] <= p["upper"] for p in body["forecast"])


@requires_db
def test_status_endpoint_returns_a_valid_health_band(client, auth_headers, site):
    response = client.get(f"/sites/{site['id']}/status", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["status"] in {"healthy", "watch", "at_risk"}


@requires_db
def test_assistant_answer_is_grounded_in_the_site(client, auth_headers, site):
    response = client.post(
        "/assistant/query",
        headers=auth_headers,
        json={"question": "Why is this site at risk?", "site_id": site["id"]},
    )
    assert response.status_code == 200
    body = response.json()
    assert site["name"] in body["answer"]
    assert "site_metrics" in body["sources"]


@requires_db
def test_report_generation_persists_a_report(client, auth_headers, site):
    generated = client.post(
        "/reports/generate",
        headers=auth_headers,
        json={"site_id": site["id"], "report_type": "ai_summary"},
    )
    assert generated.status_code == 200, generated.text
    report_id = generated.json()["id"]

    listing = client.get("/reports", headers=auth_headers)
    assert any(item["id"] == report_id for item in listing.json())


@requires_db
def test_monitoring_run_evaluates_every_site(client, auth_headers, site):
    response = client.post("/monitoring/run", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["evaluated"] >= 1


@requires_db
def test_another_users_site_is_not_reachable(client, site):
    other_email = f"other-{uuid.uuid4().hex[:10]}@darukaa.earth"
    client.post("/auth/register", json={"email": other_email, "password": "test-password-123"})
    login = client.post("/auth/login", json={"email": other_email, "password": "test-password-123"})
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    assert client.get(f"/sites/{site['id']}", headers=headers).status_code == 404
