import { useMemo, useState } from "react";
import { Plus, Search, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button, HealthBadge, SectionHeader } from "../components/ui";
import { usePortfolio } from "../hooks/useProjects";
import { formatDate } from "../utils/formatters";

export function Projects() {
  const navigate = useNavigate();
  const { data, loading, error, reload } = usePortfolio();
  const [search, setSearch] = useState("");

  const rows = useMemo(() => data.projects.filter((project) => project.name.toLowerCase().includes(search.toLowerCase())), [data.projects, search]);
  const statusByProject = useMemo(() => {
    const map = new Map<string, { healthy: number; watch: number; at_risk: number }>();
    data.projects.forEach((project) => map.set(project.id, { healthy: 0, watch: 0, at_risk: 0 }));
    data.sites.forEach((site) => {
      const entry = map.get(site.project_id);
      if (entry) entry[site.status ?? "healthy"] += 1;
    });
    return map;
  }, [data]);

  return <>
    <div className="page-title">
      <div><div className="eyebrow">WORKSPACE</div><h1>Projects</h1><p>Manage conservation projects and their monitoring sites.</p></div>
      <div className="title-actions"><Button variant="secondary" onClick={() => void reload()} disabled={loading}><RefreshCw size={16} className={loading ? "spin" : ""} /> Refresh</Button><Button onClick={() => navigate("/app/projects/new")}><Plus size={16} /> New Project</Button></div>
    </div>
    {error && <div className="error-state"><b>Could not load projects.</b><span>{error}</span><Button variant="secondary" onClick={() => void reload()}>Retry</Button></div>}
    <section className="card table-card">
      <SectionHeader eyebrow="PROJECT LIST" title={`${rows.length} project${rows.length === 1 ? "" : "s"}`} />
      <div className="table-tools"><div className="search-wrap"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search projects..." /></div></div>
      {loading ? <div className="empty-state"><b>Loading projects…</b></div> : rows.length === 0 ? <div className="empty-state"><b>No projects yet</b><small>Create a project to start monitoring sites.</small></div> : <table><thead><tr><th>Project</th><th>Type</th><th>Sites</th><th>Health</th><th>Start date</th></tr></thead><tbody>{rows.map((project) => { const status = statusByProject.get(project.id)!; const health = status.at_risk ? "at_risk" : status.watch ? "watch" : "healthy"; return <tr key={project.id} onClick={() => navigate(`/app/projects/${project.id}/overview`)}><td><b>{project.name}</b><small>{project.description || "No description"}</small></td><td>{project.project_type}</td><td>{project.site_count}</td><td><HealthBadge health={health} /></td><td>{formatDate(project.start_date)}</td></tr>; })}</tbody></table>}
    </section>
  </>;
}
