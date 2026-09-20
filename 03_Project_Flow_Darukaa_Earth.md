# Project Flow & Execution Plan
## Darukaa.Earth — Geospatial Carbon & Biodiversity Analytics Platform

---

## 1. Key User Flows

### 1.1 Create Project → Add Site (core Story 1)

```mermaid
sequenceDiagram
    participant U as Admin (Browser)
    participant F as React SPA
    participant A as FastAPI
    participant D as PostGIS DB

    U->>F: Click "New Project"
    F->>U: Show project form
    U->>F: Submit name/type/description
    F->>A: POST /projects
    A->>D: INSERT project
    D-->>A: project_id
    A-->>F: 201 Created
    F->>U: Redirect to project map, "Draw Site" active
    U->>F: Draw polygon on map
    F->>A: POST /projects/{id}/sites (GeoJSON)
    A->>D: INSERT site (ST_GeomFromGeoJSON), compute ST_Area
    D-->>A: site_id, area_ha
    A-->>F: 201 Created
    F->>U: Site appears on map with area label
```

### 1.2 Portfolio Map View (core Story 2)

```mermaid
sequenceDiagram
    participant U as Admin
    participant F as React SPA
    participant A as FastAPI

    U->>F: Open Dashboard
    F->>A: GET /projects (with nested sites + status)
    A-->>F: projects[] with site geometries + health status
    F->>U: Render map, polygons colored by status
    U->>F: Click a project in sidebar
    F->>U: Fly-to / highlight that project's sites
```

### 1.3 Site Detail + Forecast + Report (core Story 3 + differentiators)

```mermaid
sequenceDiagram
    participant U as Admin
    participant F as React SPA
    participant A as FastAPI
    participant ML as ML Layer
    participant G as GenAI Layer

    U->>F: Click a site polygon
    F->>A: GET /sites/{id}/metrics
    F->>A: GET /sites/{id}/forecast
    A->>ML: fit + project
    ML-->>A: forecast + CI
    A-->>F: series + forecast
    F->>U: Render chart w/ forecast overlay + status badge
    U->>F: Click "Generate Report"
    F->>A: POST /reports/generate {site_id}
    A->>G: draft_summary(site, metrics, status)
    G-->>A: narrative text
    A-->>F: report content
    F->>U: Display / download report
```

### 1.4 Autonomous Agent Loop (differentiator)

```mermaid
sequenceDiagram
    participant S as Scheduler (APScheduler)
    participant Agent as Agent Job
    participant ML as Anomaly Model
    participant G as GenAI Layer
    participant D as DB

    S->>Agent: trigger (interval)
    loop for each site
        Agent->>D: fetch recent metrics
        Agent->>ML: evaluate(metrics)
        ML-->>Agent: status, score
        alt status became at_risk
            Agent->>G: draft_alert(site, metrics, score)
            G-->>Agent: alert text
            Agent->>D: insert Report + Notification
        end
        Agent->>D: update site_status
    end
```

---

## 2. Repository & Git Workflow

```
darukaa-earth/
├── frontend/           # React + TS + Vite
├── backend/            # FastAPI app
│   ├── app/
│   │   ├── api/        # routers
│   │   ├── models/     # SQLAlchemy models
│   │   ├── services/   # geospatial, ml, genai, agent
│   │   └── core/       # config, security
│   ├── alembic/
│   └── tests/
├── .github/workflows/ci.yml
├── docker-compose.yml
└── README.md
```

**Branching:** `main` (protected, always deployable) ← `feature/*` branches ← PR with CI checks
required to pass before merge. Keep commits scoped and messages conventional
(`feat:`, `fix:`, `chore:`) — this directly feeds the "clean, logical commit history" deliverable.

---

## 3. Suggested Build Order (time-boxed for a hackathon)

| Phase | Focus | Exit criteria |
|---|---|---|
| **0. Scaffolding (Day 1 AM)** | Repo, Docker Compose (Postgres+PostGIS), FastAPI skeleton, React+Vite skeleton, pre-commit hooks wired up **first** | `docker-compose up` runs both services locally; a commit is blocked by lint if it's broken |
| **1. Auth + Data Model (Day 1 PM)** | Users, JWT login/register, Project/Site models + Alembic migration | Can register, log in, and create a project via API |
| **2. Map & Draw (Day 1 PM–Day 2 AM)** | Mapbox integration, polygon draw → save site, area calc | Story 1 fully working end-to-end |
| **3. Portfolio Map + Charts (Day 2)** | All-projects map view, site detail charts (real or seeded data) | Stories 2 & 3 fully working |
| **4. Seed synthetic time-series** | Script to generate plausible per-site metric history with injected anomalies | Every site has 6–12 months of data |
| **5. ML Layer** | Forecast endpoint, anomaly classification, wire status into map color | Forecast line + colored polygons visible in UI |
| **6. GenAI Layer** | LLMProvider abstraction, Ask Darukaa endpoint + panel, report generation | Can ask a question and get a grounded answer; can generate a report |
| **7. Agent Loop** | APScheduler job, notification feed in UI | New at-risk site produces a visible notification without manual trigger |
| **8. CI/CD + Deploy** | GitHub Actions workflow, Vercel + Render deploy, verify push-to-deploy | Public URL live, pipeline green |
| **9. README + polish** | Architecture write-up, schema diagram, setup instructions, trade-offs section, UI pass | All submission deliverables complete |

If time runs short, cut in this order: 5 (Report) stretch feature → Agent scheduling frequency
(demo it via manual trigger endpoint instead of a live scheduler) → viewer role → PWA/offline.
**Never cut:** the 3 core stories, pre-commit hooks, or CI/CD — those are explicitly and heavily
weighted in the evaluation criteria.

---

## 4. README.md Outline (map directly to submission deliverables)

1. **Overview** — one paragraph, link to live demo.
2. **Architecture** — the system diagram from the TRD, plus a short "why FastAPI / why PostGIS /
   why this LLM approach" trade-offs section.
3. **Database schema** — table list + ER diagram.
4. **Local setup** — `docker-compose up`, `.env.example`, seed script command.
5. **CI/CD** — explain the GitHub Actions workflow and the pre-commit hook setup, with a snippet
   of the workflow YAML.
6. **AI/ML/GenAI/Agentic AI section** — explicitly walk through each of the 4 differentiator
   features and *why* they were chosen (this is where "Product Mindedness" and "Trade-offs"
   scoring happens — don't leave evaluators to infer it from code alone).
7. **Known limitations / what I'd do with more time** — shows self-awareness, scores well.

---

## 5. Submission Checklist (per the PS's own instructions)

- [ ] Private GitHub repo, clean commit history
- [ ] Access granted to: ankita.dasgupta@darukaa.com, harsh.kumar@darukaa.com,
      utkarsh.gauniyal@darukaa.com, guneet.mutreja@darukaa.com (only if repo is private)
- [ ] Live public demo URL working
- [ ] README.md complete per outline above
- [ ] Word document (.docx) prepared for the applied-job page containing: repo link, live demo
      URL, README overview, and any credentials/notes needed to review the submission
