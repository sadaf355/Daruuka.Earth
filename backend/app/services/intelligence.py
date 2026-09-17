"""ML layer: synthetic metric generation, anomaly scoring and trend forecasting.

Design notes (see README "Trade-offs"):
* Metric history is generated deterministically from the site UUID so every environment
  (local, CI, demo) produces the same series for the same site — reproducible demos.
* Anomaly detection blends an unsupervised IsolationForest score with explicit
  baseline-deviation ratios. The forest alone is a black box; the ratios give us the
  human-readable "reasons" the UI and the GenAI layer surface.
* Both evaluation and forecasting are cached in-process with a short TTL because the
  site list endpoint would otherwise refit a model per site on every page load.
"""

from __future__ import annotations

import math
import time
import uuid
from datetime import UTC, date, datetime, timedelta
from statistics import mean, pstdev

from sklearn.ensemble import IsolationForest
from sklearn.linear_model import LinearRegression
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.site_metric import SiteMetric
from app.models.site_status import HealthStatus, SiteStatus

METRICS = ("carbon_tco2e", "biodiversity_index", "ndvi")

# How long an evaluation / forecast stays warm before we refit the model.
EVALUATION_TTL_SECONDS = 300
FORECAST_TTL_SECONDS = 3600

_forecast_cache: dict[tuple[str, str, int], tuple[float, tuple[list[dict], list[dict]]]] = {}


def _cache_get(key: tuple[str, str, int], ttl: int):
    hit = _forecast_cache.get(key)
    if hit and (time.monotonic() - hit[0]) < ttl:
        return hit[1]
    return None


def _cache_put(key: tuple[str, str, int], value) -> None:
    _forecast_cache[key] = (time.monotonic(), value)


def clear_caches() -> None:
    """Test helper — drops the in-process forecast cache."""
    _forecast_cache.clear()


def ensure_synthetic_metrics(db: Session, site_id: uuid.UUID, days: int = 180) -> list[SiteMetric]:
    """Return a site's metric history, generating a plausible synthetic series on first access.

    The series carries a slow upward restoration trend, a seasonal oscillation, and an
    injected disturbance window so that some sites legitimately trip the anomaly detector.
    """
    existing = (
        db.execute(select(SiteMetric).where(SiteMetric.site_id == site_id).order_by(SiteMetric.recorded_at))
        .scalars()
        .all()
    )
    if existing:
        return existing

    seed = int(site_id.int % 10_000)
    base = date.today() - timedelta(days=days - 1)
    rows: list[SiteMetric] = []
    for i in range(days):
        seasonal = math.sin(i / 18 + seed / 700) * 0.035
        trend = i / max(days - 1, 1)
        disturbance = 0.0
        if 132 <= i <= 145:
            disturbance = (i - 132) / 14 * 0.10
        elif 145 < i <= 158:
            disturbance = max(0.0, 0.10 - (i - 145) / 13 * 0.05)

        carbon = 4100 + (seed % 650) + trend * 700 + seasonal * 300 - disturbance * 800
        biodiversity = 64 + (seed % 90) / 10 + trend * 4 + seasonal * 18 - disturbance * 25
        ndvi = 0.54 + (seed % 90) / 1000 + trend * 0.10 + seasonal - disturbance * 0.30

        rows.append(
            SiteMetric(
                site_id=site_id,
                recorded_at=base + timedelta(days=i),
                carbon_tco2e=round(carbon, 2),
                biodiversity_index=round(biodiversity, 2),
                ndvi=round(max(0.05, min(0.95, ndvi)), 4),
            )
        )

    db.add_all(rows)
    db.flush()
    return rows


def classify(score: float) -> HealthStatus:
    """Map a 0–1 anomaly score onto the three health bands used across the product."""
    if score >= 0.70:
        return HealthStatus.at_risk
    if score >= 0.40:
        return HealthStatus.watch
    return HealthStatus.healthy


def score_metrics(metrics: list) -> tuple[float, list[str]]:
    """Pure scoring function — no database access, so it is directly unit-testable."""
    if len(metrics) < 14:
        return 0.0, []

    recent = metrics[-7:]
    prior = metrics[-28:-7]

    def delta(name: str) -> float:
        return mean(getattr(x, name) for x in recent) - mean(getattr(x, name) for x in prior)

    ndvi_drop = max(0.0, -delta("ndvi") / 0.12)
    bio_drop = max(0.0, -delta("biodiversity_index") / 10)
    carbon_change = max(0.0, -delta("carbon_tco2e") / 600)

    # Fit the forest on *first differences*, not raw levels. A healthy restoration site
    # trends steadily upward, so its newest reading is always the extreme of the level
    # distribution and a level-fitted forest flags every healthy site as anomalous. Period
    # -over-period change is stationary, which is what we actually want to detect.
    window = metrics[-61:]
    deltas = [
        [
            window[i].carbon_tco2e - window[i - 1].carbon_tco2e,
            window[i].biodiversity_index - window[i - 1].biodiversity_index,
            window[i].ndvi - window[i - 1].ndvi,
        ]
        for i in range(1, len(window))
    ]
    try:
        forest = IsolationForest(contamination=0.08, random_state=42, n_estimators=100)
        forest.fit(deltas[:-1])
        raw = float(-forest.decision_function([deltas[-1]])[0])
        model_score = max(0.0, min(1.0, 0.5 + raw * 2.2))
    except Exception:
        # A degenerate series (all-identical values) can make the forest unfittable.
        # Falling back to the deterministic ratios keeps the endpoint alive.
        model_score = 0.0

    score = max(
        0.0,
        min(1.0, 0.55 * model_score + 0.20 * ndvi_drop + 0.15 * bio_drop + 0.10 * carbon_change),
    )

    reasons: list[str] = []
    if ndvi_drop > 0.35:
        reasons.append("NDVI has declined versus the recent baseline")
    if bio_drop > 0.25:
        reasons.append("Biodiversity index is below its recent baseline")
    if carbon_change > 0.25:
        reasons.append("Carbon trajectory shows a recent negative deviation")
    if not reasons and score >= 0.55:
        reasons.append("Multiple metrics deviate from the recent baseline")

    return score, reasons


def evaluate_site(
    db: Session,
    site_id: uuid.UUID,
    metrics: list[SiteMetric] | None = None,
    force: bool = False,
) -> SiteStatus:
    """Score a site, persist the result on `site_status`, and return the row.

    Re-uses a recent evaluation unless `force=True`, so listing 50 sites does not fit
    50 IsolationForests on every request.
    """
    row = db.get(SiteStatus, site_id)
    if row is not None and not force and row.last_evaluated_at is not None:
        last = row.last_evaluated_at
        if last.tzinfo is None:
            last = last.replace(tzinfo=UTC)
        age = (datetime.now(UTC) - last).total_seconds()
        if age < EVALUATION_TTL_SECONDS:
            row._darukaa_reasons = getattr(row, "_darukaa_reasons", [])
            return row

    metrics = metrics or ensure_synthetic_metrics(db, site_id)
    score, reasons = score_metrics(metrics)

    if row is None:
        row = SiteStatus(site_id=site_id)
        db.add(row)

    row.status = classify(score)
    row.anomaly_score = round(score, 3)
    row.last_evaluated_at = datetime.now(UTC)
    db.flush()
    row._darukaa_reasons = reasons  # runtime-only helper for response/report generation
    return row


def forecast_metric(
    db: Session,
    site_id: uuid.UUID,
    metric: str,
    periods: int = 6,
) -> tuple[list[dict], list[dict]]:
    """Fit a linear trend over the last 90 observations and project `periods` months ahead.

    The confidence band is 1.96 * residual sigma, widened with the forecast horizon — a
    deliberately simple interval. A full ARIMA/Prophet interval was out of scope; this is
    honest about its own uncertainty and costs no extra infrastructure.
    """
    cache_key = (str(site_id), metric, periods)
    cached = _cache_get(cache_key, FORECAST_TTL_SECONDS)
    if cached is not None:
        return cached

    metrics = ensure_synthetic_metrics(db, site_id)
    series = metrics[-90:]
    values = [float(getattr(m, metric)) for m in series]
    xs = list(range(len(values)))

    model = LinearRegression().fit([[x] for x in xs], values)
    fitted = model.predict([[x] for x in xs])
    residuals = [values[i] - float(fitted[i]) for i in range(len(values))]
    sigma = pstdev(residuals) if len(residuals) > 1 else max(abs(values[-1]) * 0.02, 0.01)

    last_date = series[-1].recorded_at
    historical = [
        {
            "recorded_at": m.recorded_at,
            "value": round(float(getattr(m, metric)), 4),
            "lower": round(float(getattr(m, metric)), 4),
            "upper": round(float(getattr(m, metric)), 4),
        }
        for m in series
    ]

    future: list[dict] = []
    for step in range(1, periods + 1):
        x = len(values) - 1 + step * 30
        predicted = float(model.predict([[x]])[0])
        band = 1.96 * sigma * math.sqrt(1 + step / periods)
        if metric == "ndvi":
            predicted = max(0.0, min(1.0, predicted))
        if metric == "biodiversity_index":
            predicted = max(0.0, min(100.0, predicted))
        future.append(
            {
                "recorded_at": last_date + timedelta(days=step * 30),
                "value": round(predicted, 4),
                "lower": round(max(0.0, predicted - band), 4),
                "upper": round(predicted + band, 4),
            }
        )

    result = (historical, future)
    _cache_put(cache_key, result)
    return result
