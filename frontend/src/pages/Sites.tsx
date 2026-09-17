import { useMemo, useState } from "react";
import { Plus, RefreshCw, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { HealthBadge, Button, SectionHeader } from "../components/ui";
import { usePortfolio } from "../hooks/useProjects";
import { formatArea } from "../utils/formatters";
import type { Health } from "../types";

export function Sites() {
  const navigate = useNavigate();
  const { data, loading, error, reload } = usePortfolio();
  const [search, setSearch] = useState("");
  const [healthFilter, setHealthFilter] = useState<"all" | Health>("all");
  const [projectFilter, setProjectFilter] = useState("all");

  const rows = useMemo(() => data.sites.filter((site) => {
    const matchesSearch = `${site.name} ${site.projectName ?? ""}`.toLowerCase().includes(search.toLowerCase());
    const matchesHealth = healthFilter === "all" || (site.status ?? "healthy") === healthFilter;
    const matchesProject = projectFilter === "all" || site.project_id === projectFilter;
    return matchesSearch && matchesHealth && matchesProject;
  }), [data.sites, healthFilter, projectFilter, search]);

  return <>
    <div className="page-title"><div><div className="eyebrow">MONITORING ASSETS</div><h1>Sites</h1><p>{data.sites.length} geographical sites across your portfolio.</p></div><div className="title-actions"><Button variant="secondary" onClick={() => void reload()} disabled={loading}><RefreshCw size={16} className={loading ? "spin" : ""} /> Refresh</Button><Button onClick={() => navigate("/app/projects/new")}><Plus size={16} /> Add site</Button></div></div>
    {error && <div className="error-state"><b>Could not load sites.</b><span>{error}</span><Button variant="secondary" onClick={() => void reload()}>Retry</Button></div>}
    <div className="card table-card"><SectionHeader eyebrow="SITE DIRECTORY" title={`${rows.length} visible site${rows.length === 1 ? "" : "s"}`} /><div className="table-tools"><div className="search-wrap"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search sites..." /></div><select value={healthFilter} onChange={(event) => setHealthFilter(event.target.value as "all" | Health)}><option value="all">All health</option><option value="healthy">Healthy</option><option value="watch">Watch</option><option value="at_risk">At risk</option></select><select value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}><option value="all">All projects</option>{data.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></div>{loading ? <div className="empty-state"><b>Loading sites…</b></div> : rows.length === 0 ? <div className="empty-state"><b>No sites match these filters.</b><small>Try a different search or filter.</small></div> : <table><thead><tr><th>Site</th><th>Project</th><th>Area</th><th>Health</th><th>Created</th></tr></thead><tbody>{rows.map((site) => <tr key={site.id} onClick={() => navigate(`/app/sites/${site.id}`)}><td><b>{site.name}</b></td><td>{site.projectName || site.project_id}</td><td>{formatArea(site.area_ha)} ha</td><td><HealthBadge health={site.status ?? "healthy"} /></td><td>{new Date(site.created_at).toLocaleDateString()}</td></tr>)}</tbody></table>}</div>
  </>;
}
