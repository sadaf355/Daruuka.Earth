"""Shared test fixtures.

The unit tests deliberately run with no database: the risky logic (anomaly scoring,
forecast shape, token handling, geometry SQL) is pure and testable in isolation. The
integration suite in `test_api_integration.py` opts in only when a live Postgres+PostGIS
instance is reachable.
"""

import math
import os
from dataclasses import dataclass
from datetime import date, timedelta

import pytest

os.environ.setdefault("SECRET_KEY", "test-secret-key-not-for-production")
# The integration suite drives the app through TestClient's context manager, which runs the
# lifespan hook. Without this the autonomous agent would start sweeping mid-test.
os.environ.setdefault("AGENT_ENABLED", "false")


@dataclass
class FakeMetric:
    """Stands in for a SiteMetric row — the scoring code only reads attributes."""

    recorded_at: date
    carbon_tco2e: float
    biodiversity_index: float
    ndvi: float


def build_series(days: int = 60, ndvi_drop: float = 0.0, bio_drop: float = 0.0) -> list[FakeMetric]:
    """A rising series with deterministic noise, optionally collapsing over the final week.

    The noise is a sine rather than `random` so the suite is reproducible, and it is what
    gives the forecast a non-zero residual sigma — a perfectly linear series would produce
    a zero-width confidence band and make the band assertions vacuous.
    """
    start = date.today() - timedelta(days=days - 1)
    rows: list[FakeMetric] = []
    for i in range(days):
        wobble = math.sin(i / 3.0)
        in_tail = i >= days - 7
        rows.append(
            FakeMetric(
                recorded_at=start + timedelta(days=i),
                carbon_tco2e=4000 + i * 3.0 + wobble * 12.0,
                biodiversity_index=70.0 + i * 0.02 + wobble * 0.4 - (bio_drop if in_tail else 0.0),
                ndvi=0.70 + i * 0.0005 + wobble * 0.006 - (ndvi_drop if in_tail else 0.0),
            )
        )
    return rows


@pytest.fixture
def healthy_series() -> list[FakeMetric]:
    return build_series()


@pytest.fixture
def degraded_series() -> list[FakeMetric]:
    return build_series(ndvi_drop=0.22, bio_drop=14.0)
