import { useState } from "react";
import { AlertTriangle, ArrowLeft, FileText, Loader2, MapPin, RefreshCw, Sparkles } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { EnvironmentalChart } from "../components/charts/EnvironmentalChart";
import { PortfolioMap } from "../components/map/PortfolioMap";
import { Button, HealthBadge, Kpi, SectionHeader } from "../components/ui";
import { useSite } from "../hooks/useSites";
import { usePortfolio } from "../hooks/useProjects";
import { useForecast, useMetrics, useSiteStatus } from "../hooks/useMetrics";
import type { MetricName } from "../types/metrics";
import { formatArea } from "../utils/formatters";
import { generateReport } from "../services/ai.api";

const METRIC_TABS: { id: MetricName; label: string }[] = [
  { id: "carbon", label: "Carbon" },
  { id: "biodiversity", label: "Biodiversity" },
  { id: "ndvi", label: "NDVI" },
];

export function SiteDetail() {
  const { siteId = "" } = useParams();
  const navigate = useNavigate();

  const { data: site, loading: siteLoading, error: siteError } = useSite(siteId);
  const { data: portfolio } = usePortfolio();
  const { data: metrics, loading: metricsLoading, error: metricsError, reload: reloadMetrics } =
    useMetrics(siteId, 180);
  const [metric, setMetric] = useState<MetricName>("carbon");
  const { data: forecast, loading: forecastLoading } = useForecast(siteId, metric);
  const { data: status, loading: statusLoading } = useSiteStatus(siteId);

  const [generating, setGenerating] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  if (siteLoading) {
    return (
      <div className="empty-state">
        <b>Loading site…</b>
        <small>Fetching geometry, environmental metrics and intelligence.</small>
      </div>
    );
  }

  if (siteError || !site) {
    return (
      <div className="error-state">
        <b>Site could not be loaded.</b>
        <span>{siteError || "Site not found."}</span>
        <Button variant="secondary" onClick={() => navigate("/app/sites")}>
          Back to sites
        </Button>
      </div>
    );
  }

  const projectName = portfolio.projects.find((p) => p.id === site.project_id)?.name ?? site.project_id;
  const health = status?.status ?? site.status ?? "healthy";
  const latest = metrics?.points.at(-1);
  const anomaly = status?.anomaly_score ?? 0;

  const makeReport = async () => {
    setGenerating(true);
    setReportError(null);
    try {
      const report = await generateReport({ siteId: site.id, reportType: "ai_summary" });
      navigate(`/app/reports/${report.id}`);
    } catch (error) {
      setReportError(error instanceof Error ? error.message : "Report generation failed.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      <button className="back" onClick={() => navigate("/app/sites")}>
        <ArrowLeft size={16} /> All sites
      </button>

      <div className="site-title">
        <div>
          <div className="eyebrow">SITE DETAIL</div>
          <h1>{site.name}</h1>
          <p>
            <MapPin size={14} /> {projectName} · {formatArea(site.area_ha)} hectares
          </p>
        </div>
        <div className="title-actions">
          <HealthBadge health={health} />
          <Button onClick={() => void makeReport()} disabled={generating}>
            {generating ? <Loader2 className="spin" size={16} /> : <FileText size={16} />} Generate
            Report
          </Button>
        </div>
      </div>

      {reportError && <div className="error-inline">{reportError}</div>}

      {health !== "healthy" && (
        <div className={health === "at_risk" ? "risk-banner" : "watch-banner"}>
          <div className="risk-icon">
            <AlertTriangle />
          </div>
          <div>
            <b>Site Health: {health.replace("_", " ").toUpperCase()}</b>
            <p>
              {status?.reasons?.length
                ? status.reasons.join(" · ")
                : "The latest environmental signals indicate that this site needs closer monitoring."}
            </p>
            <small>
              ML anomaly score: {anomaly.toFixed(2)} ·{" "}
              {statusLoading
                ? "Evaluating…"
                : status?.last_evaluated_at
                  ? `Evaluated ${new Date(status.last_evaluated_at).toLocaleString()}`
                  : "Pending evaluation"}
            </small>
          </div>
        </div>
      )}

      <div className="kpi-grid">
        <Kpi label="Area" value={formatArea(site.area_ha)} sub="hectares" />
        <Kpi
          label="Carbon"
          value={latest ? latest.carbon_tco2e.toLocaleString() : "—"}
          sub="tCO₂e latest"
        />
        <Kpi
          label="Biodiversity"
          value={latest ? latest.biodiversity_index.toFixed(1) : "—"}
          sub="index latest"
        />
        <Kpi label="NDVI" value={latest ? latest.ndvi.toFixed(3) : "—"} sub="vegetation index" />
      </div>

      <div className="card chart-card site-chart">
        <SectionHeader
          eyebrow="PERFORMANCE & FORECAST"
          title="Environmental metrics"
          action={
            <div className="metric-tabs">
              {METRIC_TABS.map((tab) => (
                <button
                  key={tab.id}
                  className={metric === tab.id ? "active" : ""}
                  onClick={() => setMetric(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          }
        />
        {metricsLoading ? (
          <div className="loading-list">
            <span />
            <span />
          </div>
        ) : metricsError ? (
          <div className="error-state">
            <b>Metrics unavailable.</b>
            <span>{metricsError}</span>
            <Button variant="secondary" onClick={() => void reloadMetrics()}>
              <RefreshCw size={15} /> Retry
            </Button>
          </div>
        ) : metrics?.points.length ? (
          <EnvironmentalChart points={metrics.points} forecast={forecast} metric={metric} />
        ) : (
          <div className="empty-state">
            <b>No metric observations yet.</b>
            <small>Seed or ingest environmental observations for this site.</small>
          </div>
        )}
        <div className="forecast-note">
          <Sparkles size={17} />
          <span>
            <b>{forecastLoading ? "Generating forecast…" : "ML forecast connected"}</b> · 6 future
            periods ·{" "}
            {forecast?.confidence
              ? `${Math.round(forecast.confidence * 100)}% confidence interval`
              : "confidence interval pending"}{" "}
            · {forecast?.model ?? "model pending"}
          </span>
        </div>
      </div>

      <div className="two-col">
        <section className="card">
          <SectionHeader eyebrow="SITE GEOMETRY" title="Saved monitoring boundary" />
          <div className="site-boundary-map">
            <PortfolioMap sites={[{ ...site, projectName }]} zoom={12} />
          </div>
          <div className="site-geometry-note">
            <b>{formatArea(site.area_ha)} ha</b>
            <span>Computed by PostGIS from the saved polygon (SRID 4326).</span>
          </div>
        </section>

        <section className="card">
          <SectionHeader eyebrow="DARUKAA AI" title="Site intelligence" />
          <p className="ai-copy">
            Ask Darukaa is grounded in this site's metrics, forecast and anomaly status — it can
            only answer from data this site actually has.
          </p>
          <Button
            onClick={() => navigate(`/app/assistant?siteId=${site.id}&projectId=${site.project_id}`)}
          >
            <Sparkles size={16} /> Ask Darukaa about this site
          </Button>
        </section>
      </div>
    </>
  );
}
