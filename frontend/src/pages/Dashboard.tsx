import { useMemo, useState } from "react";
import { ArrowUpRight, ChevronRight, Plus, RefreshCw, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PortfolioMap } from "../components/map/PortfolioMap";
import { Button, Kpi, SectionHeader } from "../components/ui";
import { usePortfolio } from "../hooks/useProjects";
import { formatArea } from "../utils/formatters";

export function Dashboard() {
  const navigate = useNavigate();
  const { data, loading, error, reload } = usePortfolio();
  const [search, setSearch] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("all");

  const filteredProjects = useMemo(
    () => data.projects.filter((project) => project.name.toLowerCase().includes(search.toLowerCase())),
    [data.projects, search]
  );

  const health = useMemo(() => data.sites.reduce((acc, site) => {
    const status = site.status ?? "healthy";
    acc[status] += 1;
    return acc;
  }, { healthy: 0, watch: 0, at_risk: 0 }), [data.sites]);

  const totalArea = useMemo(() => data.sites.reduce((sum, site) => sum + site.area_ha, 0), [data.sites]);
  const mapSites = selectedProjectId === "all" ? data.sites : data.sites.filter((site) => site.project_id === selectedProjectId);

  return (
    <>
      <div className="page-title">
        <div>
          <div className="eyebrow">PORTFOLIO OVERVIEW</div>
          <h1>Environmental intelligence</h1>
          <p>Monitor the health and performance of your conservation portfolio.</p>
        </div>
        <div className="title-actions">
          <Button variant="secondary" onClick={() => void reload()} disabled={loading}><RefreshCw size={16} className={loading ? "spin" : ""} /> Refresh</Button>
          <Button onClick={() => navigate("/app/projects/new")}><Plus size={17} /> New Project</Button>
        </div>
      </div>

      {error && <div className="error-state"><b>Portfolio data could not be loaded.</b><span>{error}</span><Button variant="secondary" onClick={() => void reload()}>Retry</Button></div>}

      <div className="kpi-grid">
        <Kpi label="Projects" value={loading ? "—" : String(data.projects.length)} sub="From your workspace" />
        <Kpi label="Monitoring sites" value={loading ? "—" : String(data.sites.length)} sub={`${formatArea(totalArea)} ha monitored`} />
        <Kpi label="Healthy sites" value={loading ? "—" : String(health.healthy)} sub="Current site status" />
        <Kpi label="Sites at risk" value={loading ? "—" : String(health.at_risk)} sub={`${health.watch} on watch`} trend={health.at_risk ? -1 : undefined} />
      </div>

      <div className="dashboard-map-grid">
        <aside className="project-panel">
          <SectionHeader eyebrow="PORTFOLIO" title="Projects" action={<button className="text-btn" onClick={() => navigate("/app/projects")}>View all <ArrowUpRight size={14} /></button>} />
          <input className="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="⌕  Search projects..." />
          {loading ? <div className="loading-list"><span /><span /><span /></div> : filteredProjects.length === 0 ? <div className="empty-state"><b>No projects found</b><small>Create your first monitoring project.</small></div> : <div className="project-list">
            {filteredProjects.map((project) => (
              <button className="project-row" key={project.id} onClick={() => navigate(`/app/projects/${project.id}/overview`)}>
                <span className="project-icon">◇</span>
                <span><b>{project.name}</b><small>{project.site_count} monitoring sites</small></span>
                <ChevronRight size={16} />
              </button>
            ))}
          </div>}
          <div className="mini-summary">
            <div><span className="dot healthy" /> Healthy <b>{health.healthy}</b></div>
            <div><span className="dot watch" /> Watch <b>{health.watch}</b></div>
            <div><span className="dot at_risk" /> At risk <b>{health.at_risk}</b></div>
          </div>
        </aside>
        <section className="map-panel">
          <div className="map-panel-head"><div><b>Live portfolio map</b><span>{mapSites.length} visible monitoring sites from PostGIS</span></div><select className="map-project-filter" value={selectedProjectId} onChange={(event) => setSelectedProjectId(event.target.value)}><option value="all">All projects</option>{data.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></div>
          <PortfolioMap sites={data.sites} />
        </section>
      </div>

      <div className="bottom-grid">
        <section className="card">
          <SectionHeader eyebrow="PORTFOLIO STATE" title="Monitoring signals" action={<button className="text-btn" onClick={() => navigate("/app/analytics")}>View analytics <ArrowUpRight size={15} /></button>} />
          <div className="signals">
            <div><span>Projects</span><strong>{data.projects.length}</strong><small>Owned workspaces</small></div>
            <div><span>Sites monitored</span><strong>{data.sites.length}</strong><small>Live database records</small></div>
            <div><span>Area monitored</span><strong>{formatArea(totalArea)}</strong><small>hectares</small></div>
          </div>
        </section>
        <section className="card intelligence">
          <div className="ai-icon"><Sparkles /></div>
          <div><div className="eyebrow">DARUKAA INTELLIGENCE</div><h3>{health.at_risk} sites require attention</h3><p>Health status is derived from the current site records. ML signals are now connected to site health and anomaly evaluation.</p><button className="text-btn" onClick={() => navigate("/app/assistant")}>Ask Darukaa <ArrowUpRight size={15} /></button></div>
        </section>
      </div>
    </>
  );
}
