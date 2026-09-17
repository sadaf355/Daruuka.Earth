import { useMemo, useState } from "react";
import { ArrowLeft, FileText, Map, RefreshCw, Sparkles } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { PortfolioMap } from "../components/map/PortfolioMap";
import { EnvironmentalChart } from "../components/charts/EnvironmentalChart";
import { Button, HealthBadge, Kpi, SectionHeader } from "../components/ui";
import { useProject, useProjectSites } from "../hooks/useProjects";
import { useProjectMetrics } from "../hooks/useMetrics";
import { generateReport } from "../services/ai.api";
import { formatArea } from "../utils/formatters";
import type { Health } from "../types";

const TABS: [string, string][] = [
  ["overview", "Overview"],
  ["map", "Map"],
  ["sites", "Sites"],
  ["analytics", "Analytics"],
  ["reports", "Reports"],
];

const EMPTY_HEALTH: Record<Health, number> = { healthy: 0, watch: 0, at_risk: 0 };

/** Percentage width for the health distribution bars, guarding against divide-by-zero. */
const share = (count: number, total: number) => `${total ? (count / total) * 100 : 0}%`;

function LoadingProject() {
  return (
    <div className="empty-state">
      <b>Loading project…</b>
      <small>Fetching project details from the API.</small>
    </div>
  );
}

function HealthBars({ counts, total }: { counts: Record<Health, number>; total: number }) {
  return (
    <div className="health-bars">
      <div>
        <span>Healthy</span>
        <b style={{ width: share(counts.healthy, total) }} />
        <em>{counts.healthy}</em>
      </div>
      <div>
        <span>Watch</span>
        <b style={{ width: share(counts.watch, total) }} />
        <em>{counts.watch}</em>
      </div>
      <div>
        <span>At risk</span>
        <b style={{ width: share(counts.at_risk, total) }} />
        <em>{counts.at_risk}</em>
      </div>
    </div>
  );
}

export function Head({ active }: { active: string }) {
  const { projectId = "" } = useParams();
  const navigate = useNavigate();
  const { data: project, loading, error, reload } = useProject(projectId);
  const { data: sites } = useProjectSites(projectId);

  if (loading) return <LoadingProject />;

  if (error || !project) {
    return (
      <div className="error-state">
        <b>Project could not be loaded.</b>
        <span>{error || "Project not found."}</span>
        <Button variant="secondary" onClick={() => void reload()}>
          <RefreshCw size={16} /> Retry
        </Button>
      </div>
    );
  }

  return (
    <>
      <button className="back" onClick={() => navigate("/app/projects")}>
        <ArrowLeft size={16} /> Projects
      </button>

      <div className="project-head">
        <div>
          <div className="eyebrow">PROJECT</div>
          <h1>{project.name}</h1>
          <p>
            {project.project_type} · Monitoring workspace · {sites.length} sites
          </p>
        </div>
        <Button onClick={() => navigate(`/app/projects/${project.id}/map`)}>
          <Map size={16} /> Open map
        </Button>
      </div>

      <div className="tabs">
        {TABS.map(([key, label]) => (
          <button
            className={active === key ? "active" : ""}
            key={key}
            onClick={() => navigate(`/app/projects/${project.id}/${key}`)}
          >
            {label}
          </button>
        ))}
      </div>
    </>
  );
}

export function ProjectOverview() {
  const { projectId = "" } = useParams();
  const navigate = useNavigate();
  const { data: project } = useProject(projectId);
  const { data: sites, loading } = useProjectSites(projectId);

  const counts = useMemo(
    () =>
      sites.reduce(
        (acc, site) => {
          acc[site.status ?? "healthy"] += 1;
          return acc;
        },
        { ...EMPTY_HEALTH },
      ),
    [sites],
  );

  const area = useMemo(() => sites.reduce((sum, site) => sum + site.area_ha, 0), [sites]);

  if (!project) return <Head active="overview" />;

  return (
    <>
      <Head active="overview" />

      <div className="kpi-grid">
        <Kpi
          label="Monitoring sites"
          value={loading ? "—" : String(sites.length)}
          sub={`${formatArea(area)} ha`}
        />
        <Kpi label="Project type" value={project.project_type} sub="Configured monitoring scope" />
        <Kpi label="Healthy" value={loading ? "—" : String(counts.healthy)} sub="Current status" />
        <Kpi
          label="At risk"
          value={loading ? "—" : String(counts.at_risk)}
          sub={`${counts.watch} on watch`}
        />
      </div>

      <div className="two-col">
        <section className="card">
          <SectionHeader eyebrow="SITE HEALTH" title="Portfolio status" />
          <HealthBars counts={counts} total={sites.length} />
        </section>

        <section className="card">
          <SectionHeader
            eyebrow="RECENT SITES"
            title="Monitoring sites"
            action={
              <button
                className="text-btn"
                onClick={() => navigate(`/app/projects/${project.id}/sites`)}
              >
                View all
              </button>
            }
          />
          {sites.slice(0, 5).map((site) => (
            <div className="site-mini" key={site.id}>
              <div>
                <b>{site.name}</b>
                <small>{formatArea(site.area_ha)} ha</small>
              </div>
              <HealthBadge health={site.status ?? "healthy"} />
            </div>
          ))}
          {sites.length === 0 && (
            <div className="empty-state">
              <b>No sites yet.</b>
              <small>Draw a polygon from the project setup flow to add one.</small>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

export function ProjectMap() {
  const { projectId = "" } = useParams();
  const { data: sites, loading } = useProjectSites(projectId);

  return (
    <>
      <Head active="map" />
      <div className="full-map">
        {loading ? (
          <div className="empty-state">
            <b>Loading project map…</b>
          </div>
        ) : (
          <PortfolioMap sites={sites} />
        )}
      </div>
    </>
  );
}

export function ProjectAnalytics() {
  const { projectId = "" } = useParams();
  const { data, loading, error, reload } = useProjectMetrics(projectId);

  const counts = useMemo(
    () =>
      (data?.sites ?? []).reduce(
        (acc, site) => {
          acc[site.health] += 1;
          return acc;
        },
        { ...EMPTY_HEALTH },
      ),
    [data],
  );

  // Rank sites by combined movement across all three metrics. Each term is normalised by a
  // rough scale for that metric so carbon (thousands) doesn't drown out NDVI (0–1).
  const topChanges = useMemo(
    () =>
      (data?.sites ?? [])
        .map((site) => ({
          ...site,
          magnitude:
            Math.abs(site.changes.ndvi) +
            Math.abs(site.changes.biodiversity) / 100 +
            Math.abs(site.changes.carbon) / 10000,
        }))
        .sort((a, b) => b.magnitude - a.magnitude)
        .slice(0, 5),
    [data],
  );

  if (loading) {
    return (
      <>
        <Head active="analytics" />
        <div className="empty-state">
          <b>Loading environmental analytics…</b>
          <small>Aggregating site observations and health signals.</small>
        </div>
      </>
    );
  }

  if (error || !data) {
    return (
      <>
        <Head active="analytics" />
        <div className="error-state">
          <b>Analytics could not be loaded.</b>
          <span>{error || "No data available."}</span>
          <Button variant="secondary" onClick={() => void reload()}>
            <RefreshCw size={15} /> Retry
          </Button>
        </div>
      </>
    );
  }

  if (data.sites.length === 0) {
    return (
      <>
        <Head active="analytics" />
        <div className="empty-state">
          <b>No sites to analyse yet.</b>
          <small>Add a monitoring site to this project to see aggregated trends.</small>
        </div>
      </>
    );
  }

  return (
    <>
      <Head active="analytics" />

      <div className="chart-grid">
        <section className="card chart-card">
          <SectionHeader eyebrow="CARBON" title="Sequestration trend" />
          <div className="chart">
            <EnvironmentalChart points={data.portfolio_points} metric="carbon" height={300} />
          </div>
        </section>
        <section className="card chart-card">
          <SectionHeader eyebrow="BIODIVERSITY" title="Index trend" />
          <div className="chart">
            <EnvironmentalChart points={data.portfolio_points} metric="biodiversity" height={300} />
          </div>
        </section>
      </div>

      <section className="card chart-card">
        <SectionHeader eyebrow="VEGETATION HEALTH" title="NDVI trend" />
        <div className="chart">
          <EnvironmentalChart points={data.portfolio_points} metric="ndvi" height={300} />
        </div>
      </section>

      <div className="two-col">
        <section className="card">
          <SectionHeader eyebrow="HEALTH DISTRIBUTION" title="Site status" />
          <HealthBars counts={counts} total={data.sites.length} />
        </section>

        <section className="card">
          <SectionHeader eyebrow="TOP CHANGES" title="Largest recent signals" />
          <div className="site-list">
            {topChanges.map((site) => (
              <div className="site-mini" key={site.site_id}>
                <div>
                  <b>{site.site_name}</b>
                  <small>
                    NDVI {site.changes.ndvi >= 0 ? "+" : ""}
                    {site.changes.ndvi.toFixed(3)} · Biodiversity{" "}
                    {site.changes.biodiversity >= 0 ? "+" : ""}
                    {site.changes.biodiversity.toFixed(1)}
                  </small>
                </div>
                <HealthBadge health={site.health} />
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

export function ProjectReports() {
  const { projectId = "" } = useParams();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      const report = await generateReport({ projectId, reportType: "funder_report" });
      navigate(`/app/reports/${report.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Report generation failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Head active="reports" />

      <div className="page-title">
        <div>
          <div className="eyebrow">REPORTS</div>
          <h2>Project intelligence</h2>
          <p>Generate a grounded project report from current environmental metrics and health signals.</p>
        </div>
        <Button onClick={() => void generate()} disabled={busy}>
          <Sparkles size={16} /> {busy ? "Generating…" : "Generate report"}
        </Button>
      </div>

      {error && <div className="error-inline">{error}</div>}

      <div className="card">
        <SectionHeader eyebrow="GENERATED INTELLIGENCE" title="Project report library" />
        <p className="ai-copy">
          Reports are persisted by the backend as structured JSON and can be reopened, re-rendered
          or printed from the main report library.
        </p>
        <Button variant="secondary" onClick={() => navigate("/app/reports")}>
          <FileText size={16} /> Open report library
        </Button>
      </div>
    </>
  );
}
