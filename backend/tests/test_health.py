from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_openapi_schema_exposes_the_core_endpoints():
    """A cheap smoke test that every router is actually mounted."""
    paths = client.get("/openapi.json").json()["paths"]
    for path in (
        "/auth/login",
        "/auth/refresh",
        "/projects",
        "/projects/{project_id}/sites",
        "/sites/{site_id}/metrics",
        "/sites/{site_id}/forecast",
        "/sites/{site_id}/status",
        "/assistant/query",
        "/reports/generate",
        "/notifications",
        "/monitoring/run",
    ):
        assert path in paths, f"{path} is missing from the OpenAPI schema"


def test_protected_endpoint_requires_a_token():
    assert client.get("/projects").status_code in (401, 403)
