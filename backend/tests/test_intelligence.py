"""Tests for the ML layer — the highest-risk logic in the product.

A wrong anomaly threshold silently mis-colours every polygon on the portfolio map, and a
forecast whose confidence band is inverted would be worse than showing no forecast at all.
"""

import uuid

import pytest

from app.models.site_status import HealthStatus
from app.services.intelligence import (
    classify,
    clear_caches,
    forecast_metric,
    score_metrics,
)
from tests.conftest import build_series


@pytest.fixture(autouse=True)
def _clear_cache():
    clear_caches()
    yield
    clear_caches()


class FakeDB:
    """Minimal Session stand-in: `forecast_metric` only reads an ordered metric list."""

    def __init__(self, rows):
        self._rows = rows

    def execute(self, _statement):
        return self

    def scalars(self):
        return self

    def all(self):
        return self._rows

    def add_all(self, _rows):
        pass

    def flush(self):
        pass


# --- Anomaly classification thresholds -------------------------------------------------


def test_classify_threshold_boundaries():
    assert classify(0.0) is HealthStatus.healthy
    assert classify(0.399) is HealthStatus.healthy
    assert classify(0.40) is HealthStatus.watch
    assert classify(0.699) is HealthStatus.watch
    assert classify(0.70) is HealthStatus.at_risk
    assert classify(1.0) is HealthStatus.at_risk


def test_steadily_improving_site_is_not_flagged(healthy_series):
    """Regression guard: fitting the forest on raw levels made every healthy rising site
    look anomalous, because its newest reading is always the extreme of the distribution.
    We fit on first differences instead, so a steady trend scores low."""
    score, reasons = score_metrics(healthy_series)
    assert classify(score) is HealthStatus.healthy, f"healthy site scored {score}"
    assert reasons == []


def test_collapsing_series_is_flagged_with_reasons(degraded_series):
    score, reasons = score_metrics(degraded_series)
    assert score > 0.40, f"expected a degraded series to score above the watch threshold, got {score}"
    assert classify(score) in {HealthStatus.watch, HealthStatus.at_risk}
    assert reasons, "a degraded site must explain itself — the UI and GenAI layer surface these"
    assert any("NDVI" in reason for reason in reasons)


def test_degraded_scores_higher_than_healthy(healthy_series, degraded_series):
    healthy_score, _ = score_metrics(healthy_series)
    degraded_score, _ = score_metrics(degraded_series)
    assert degraded_score > healthy_score


def test_short_series_is_not_scored():
    """Fewer than 14 observations is not enough signal — we must not guess."""
    score, reasons = score_metrics(build_series(days=10))
    assert score == 0.0
    assert reasons == []


def test_score_is_always_bounded():
    for drop in (0.0, 0.05, 0.3, 0.9):
        score, _ = score_metrics(build_series(ndvi_drop=drop, bio_drop=drop * 40))
        assert 0.0 <= score <= 1.0


# --- Forecasting -----------------------------------------------------------------------


def test_forecast_returns_requested_number_of_periods():
    db = FakeDB(build_series(days=40))
    historical, future = forecast_metric(db, uuid.uuid4(), "ndvi", 6)
    assert len(historical) == 40
    assert len(future) == 6


def test_forecast_confidence_band_contains_prediction():
    db = FakeDB(build_series(days=40))
    _, future = forecast_metric(db, uuid.uuid4(), "ndvi", 6)
    for point in future:
        assert point["lower"] <= point["value"] <= point["upper"]


def test_forecast_band_widens_with_horizon():
    db = FakeDB(build_series(days=60))
    _, future = forecast_metric(db, uuid.uuid4(), "carbon_tco2e", 6)
    widths = [point["upper"] - point["lower"] for point in future]
    assert all(
        widths[i] < widths[i + 1] for i in range(len(widths) - 1)
    ), "uncertainty must grow as we forecast further out"


def test_forecast_follows_an_upward_trend():
    db = FakeDB(build_series(days=60))
    _, future = forecast_metric(db, uuid.uuid4(), "carbon_tco2e", 6)
    assert future[-1]["value"] > future[0]["value"]


def test_ndvi_forecast_is_clamped_to_valid_range():
    """NDVI is physically bounded to [0, 1]; a naive linear model will happily exceed it."""
    db = FakeDB(build_series(days=40))
    _, future = forecast_metric(db, uuid.uuid4(), "ndvi", 6)
    assert all(0.0 <= point["value"] <= 1.0 for point in future)


def test_forecast_is_cached_per_site_and_metric():
    site_id = uuid.uuid4()
    db = FakeDB(build_series(days=40))
    first = forecast_metric(db, site_id, "ndvi", 6)
    second = forecast_metric(FakeDB([]), site_id, "ndvi", 6)
    assert first == second, "second call should be served from cache, not refit on empty data"
