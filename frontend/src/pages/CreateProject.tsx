import { useCallback, useState } from "react";
import { ArrowLeft, Check, MapPinned, CalendarDays, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui";
import { PortfolioMap } from "../components/map/PortfolioMap";
import { createProject } from "../services/projects.api";
import { createSite } from "../services/sites.api";
import { ApiError } from "../services/api";
import type { GeoJSONPolygon } from "../types";

type ProjectTypeLabel = "Carbon" | "Biodiversity" | "Both";
const TYPE_TO_API: Record<ProjectTypeLabel, "carbon" | "biodiversity" | "both"> = {
  Carbon: "carbon",
  Biodiversity: "biodiversity",
  Both: "both",
};

interface SavedSite {
  id: string;
  name: string;
  area_ha: number;
}

export function CreateProject() {
  const n = useNavigate();
  const [step, setStep] = useState(1);

  // Step 1 — project fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<ProjectTypeLabel>("Both");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [projectId, setProjectId] = useState<string | null>(null);
  const [creatingProject, setCreatingProject] = useState(false);
  const [projectError, setProjectError] = useState<string | null>(null);

  // Step 2 — draw & save sites
  const [siteName, setSiteName] = useState("Site 01");
  const [drawnGeometry, setDrawnGeometry] = useState<GeoJSONPolygon | null>(null);
  const [previewAreaHa, setPreviewAreaHa] = useState<number | null>(null);
  const [savedSites, setSavedSites] = useState<SavedSite[]>([]);
  const [savingSite, setSavingSite] = useState(false);
  const [siteError, setSiteError] = useState<string | null>(null);

  async function handleContinue() {
    if (!name.trim()) {
      setProjectError("Give the project a name first.");
      return;
    }
    setProjectError(null);
    setCreatingProject(true);
    try {
      const project = await createProject({
        name,
        description: description || undefined,
        project_type: TYPE_TO_API[type],
        start_date: startDate,
      });
      setProjectId(project.id);
      setStep(2);
    } catch (err) {
      setProjectError(err instanceof ApiError ? err.message : "Couldn't create the project. Is the backend running?");
    } finally {
      setCreatingProject(false);
    }
  }

  async function handleSaveSite() {
    if (!projectId || !drawnGeometry) {
      setSiteError("Draw a polygon on the map first.");
      return;
    }
    setSiteError(null);
    setSavingSite(true);
    try {
      const site = await createSite(projectId, siteName, drawnGeometry);
      setSavedSites((prev) => [...prev, { id: site.id, name: site.name, area_ha: site.area_ha }]);
      setDrawnGeometry(null);
      setPreviewAreaHa(null);
      setSiteName(`Site 0${savedSites.length + 2}`);
    } catch (err) {
      setSiteError(err instanceof ApiError ? err.message : "Couldn't save the site. Is the backend running?");
    } finally {
      setSavingSite(false);
    }
  }

  const handleDrawChange = useCallback((geometry: GeoJSONPolygon | null, area: number | null) => {
    setDrawnGeometry(geometry);
    setPreviewAreaHa(area);
  }, []);

  function handleFinish() {
    if (!projectId) return;
    n(`/app/projects/${projectId}/overview`);
  }

  return (
    <div>
      <button className="back" onClick={() => n("/app/dashboard")}>
        <ArrowLeft size={16} /> Back to portfolio
      </button>
      <div className="page-title">
        <div>
          <div className="eyebrow">PROJECT SETUP</div>
          <h1>New conservation project</h1>
          <p>Create a project, then define its monitoring sites.</p>
        </div>
        <div className="stepper">
          <span className={step >= 1 ? "done" : ""}>1</span>
          <i />
          <span className={step === 2 ? "current" : ""}>2</span>
        </div>
      </div>

      {step === 1 ? (
        <div className="form-card">
          <div className="form-section">
            <h3>Project information</h3>
            <label>
              Project name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Amazon Restoration Initiative"
              />
            </label>
            <label>
              Description
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this project monitoring?"
              />
            </label>
            <label>
              Project type
              <div className="type-grid">
                {(["Carbon", "Biodiversity", "Both"] as ProjectTypeLabel[]).map((t) => (
                  <button
                    key={t}
                    className={type === t ? "type-option selected" : "type-option"}
                    onClick={() => setType(t)}
                  >
                    <b>{t}</b>
                    <span>{t === "Carbon" ? "CO₂ sequestration" : t === "Biodiversity" ? "Ecosystem health" : "Carbon + biodiversity"}</span>
                  </button>
                ))}
              </div>
            </label>
            <label>
              Start date
              <div className="input-icon">
                <CalendarDays size={17} />
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
            </label>
          </div>
          {projectError && <p className="form-error">{projectError}</p>}
          <div className="form-actions">
            <Button variant="secondary" onClick={() => n("/app/dashboard")}>Cancel</Button>
            <Button onClick={handleContinue} disabled={creatingProject}>
              {creatingProject ? <Loader2 className="spin" size={17} /> : <>Continue <MapPinned size={17} /></>}
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <div className="draw-layout">
            <div className="draw-side">
              <div className="eyebrow">STEP 2 OF 2</div>
              <h2>Define monitoring sites</h2>
              <p>Draw a polygon on the map to define each geographical site.</p>
              <div className="draw-tool active">
                <MapPinned />
                <div>
                  <b>Draw polygon</b>
                  <small>Click points on the map, close the loop to finish</small>
                </div>
              </div>
              <label>
                Site name
                <input value={siteName} onChange={(e) => setSiteName(e.target.value)} />
              </label>
              <div className="area">
                <span>{drawnGeometry ? "Live preview area" : "Calculated area"}</span>
                <strong>
                  {previewAreaHa !== null ? previewAreaHa.toLocaleString() : "—"} <small>ha</small>
                </strong>
                <small>
                  {drawnGeometry
                    ? "Client-side preview — the saved value is computed server-side via PostGIS ST_Area"
                    : "Draw a polygon to see the area"}
                </small>
              </div>
              {siteError && <p className="form-error">{siteError}</p>}
              {savedSites.length > 0 && (
                <div className="draw-hint">
                  {savedSites.length} site{savedSites.length > 1 ? "s" : ""} saved:{" "}
                  {savedSites.map((s) => `${s.name} (${s.area_ha} ha)`).join(", ")}
                </div>
              )}
              <div className="draw-actions">
                <Button variant="secondary" onClick={handleSaveSite} disabled={!drawnGeometry || savingSite}>
                  {savingSite ? <Loader2 className="spin" size={16} /> : "+ Add another site"}
                </Button>
                <Button onClick={handleFinish} disabled={savedSites.length === 0}>
                  Save sites <Check size={16} />
                </Button>
              </div>
            </div>
            <PortfolioMap draw onDrawChange={handleDrawChange} />
          </div>
        </div>
      )}
    </div>
  );
}
