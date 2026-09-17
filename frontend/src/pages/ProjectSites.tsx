import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { Button, HealthBadge, SectionHeader } from "../components/ui";
import { useProject, useProjectSites } from "../hooks/useProjects";
import { formatArea } from "../utils/formatters";
import { Head } from "./ProjectPages";

export function ProjectSites() {
  const { projectId = "" } = useParams();
  const navigate = useNavigate();
  const { data: project, loading: projectLoading } = useProject(projectId);
  const { data: sites, loading, error, reload } = useProjectSites(projectId);
  const [search, setSearch] = useState("");
  const rows = useMemo(() => sites.filter((site) => site.name.toLowerCase().includes(search.toLowerCase())), [sites, search]);

  if (projectLoading) return <div className="empty-state"><b>Loading project…</b></div>;
  if (!project) return <div className="error-state"><b>Project not found.</b></div>;

  return <><Head active="sites"/><div className="page-title"><div><div className="eyebrow">MONITORING SITES</div><h2>{project.name}</h2><p>{sites.length} saved geographical monitoring sites.</p></div><Button onClick={() => navigate("/app/projects/new")}><Plus size={16}/> Add site</Button></div><section className="card table-card"><SectionHeader eyebrow="SITE DIRECTORY" title={`${rows.length} visible sites`} /><div className="table-tools"><div className="search-wrap"><Search size={16}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search project sites..."/></div></div>{error ? <div className="error-state"><b>Could not load sites.</b><span>{error}</span><Button variant="secondary" onClick={() => void reload()}>Retry</Button></div> : loading ? <div className="empty-state"><b>Loading sites…</b></div> : rows.length === 0 ? <div className="empty-state"><b>No sites found.</b><small>Create a monitoring site from the project setup flow.</small></div> : <table><thead><tr><th>Site</th><th>Area</th><th>Health</th><th>Created</th></tr></thead><tbody>{rows.map((site) => <tr key={site.id} onClick={() => navigate(`/app/sites/${site.id}`)}><td><b>{site.name}</b></td><td>{formatArea(site.area_ha)} ha</td><td><HealthBadge health={site.status ?? "healthy"}/></td><td>{new Date(site.created_at).toLocaleDateString()}</td></tr>)}</tbody></table>}</section></>;
}
