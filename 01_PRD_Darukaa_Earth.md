# Product Requirements Document (PRD)
## Darukaa.Earth — Geospatial Carbon & Biodiversity Analytics Platform

**Prepared for:** Darukaa.Earth Full-Stack Developer Hackathon
**Version:** 1.0

---

## 1. Vision & Positioning

Darukaa.Earth's stated need is a dashboard for managing and visualizing carbon and biodiversity
projects. The brief (`Skills Required`) also signals the company wants more than CRUD: **AI/ML
integration, GenAI, Agentic AI, cloud deployment, CI/CD, system optimization**. A submission that
only satisfies the three core user stories will be functionally correct but will look identical to every
other candidate's. The winning strategy is:

> Build the required geospatial CRUD + map + analytics platform *rock solid*, then layer on a small
> number of genuinely useful AI capabilities that map 1:1 onto the "AI/ML Integration / GenAI /
> Agentic AI" skill tags — instead of bolting on a chatbot for its own sake.

**Product one-liner:** *A geospatial project-management platform where administrators track carbon
and biodiversity sites on a map, an ML model forecasts sequestration and flags anomalies, and an
AI agent continuously watches every site and drafts human-readable status reports.**

---

## 2. Goals

| Goal | Why it matters for scoring |
|---|---|
| Fully implement all 3 core user stories | Baseline pass/fail requirement |
| Deliver a clean, logical DB schema for projects/sites/time-series metrics | "System Architecture" criterion |
| Ship a real CI/CD pipeline with pre-commit hooks | Explicitly called "crucial" in the brief |
| Add 3–4 differentiated AI features that are demoable in <2 min | Covers AI/ML, GenAI, Agentic AI tags; drives "Product Mindedness" score |
| Deploy to a public URL with a working demo | Hard requirement |
| Document trade-offs explicitly in the README | Explicitly scored under "Trade-offs" |

## 3. Non-Goals (explicitly out of scope for the hackathon window)

- Multi-tenant billing / payments
- Real satellite-imagery ingestion pipelines (mocked/synthetic data is fine per the brief's note)
- Mobile native apps (a responsive web PWA is a stretch goal only)
- Full RBAC with granular permissions (role flag: admin vs viewer is sufficient)

---

## 4. Users & Personas

| Persona | Description | Primary needs |
|---|---|---|
| **Admin (primary)** | Project manager / analyst at a carbon-credit or conservation org | Create projects, draw sites, monitor health, generate reports for funders |
| **Viewer (secondary, stretch)** | Auditor / funder / stakeholder | Read-only map + analytics access, exportable reports |
| **The Agent (system actor)** | Background AI process | Continuously evaluates site metrics, raises alerts, drafts summaries |

---

## 5. Core User Stories (from brief — must-have)

1. **As an admin**, I want to create a new project and add multiple geographical sites to it (by
   drawing polygons on a map), so that I can organize monitoring work by project.
2. **As an admin**, I want to view all projects and sites on an interactive map, so I can get a spatial
   overview of the whole portfolio.
3. **As an admin**, I want to click a specific site to view detailed analytics and performance over
   time, so I can assess how a site is trending.

### 5.1 Expanded acceptance criteria

**Story 1 — Create project & sites**
- Admin registers/logs in (JWT session).
- Admin creates a project (name, description, type: *Carbon* | *Biodiversity* | *Both*, start date).
- Inside a project, admin draws one or more polygons on the map (Mapbox GL Draw) to define sites.
- On save, the app auto-computes and stores site area (hectares) via PostGIS `ST_Area`.
- Each site gets a name, and (for realism) a seeded/synthetic time-series of metrics (see §6.3).

**Story 2 — Portfolio map view**
- A single map renders all projects' sites as colored polygons (color = health status: healthy /
  watch / at-risk, driven by the anomaly model — this is where "Data Visualization" +
  "AI/ML Integration" intersect).
- Clicking a project in a sidebar list zooms/highlights its sites.
- Map supports clustering when zoomed out and satellite/street basemap toggle.

**Story 3 — Site detail & analytics**
- Clicking a site polygon (or a list row) opens a detail view with:
  - Time-series charts: carbon sequestration estimate, biodiversity index, NDVI (vegetation
    health) — line charts via Chart.js/Highcharts.
  - A forecast overlay (next 6 periods) from the ML model, with confidence band.
  - An anomaly banner if the agent has flagged this site.
  - A "Generate Report" button that produces a GenAI narrative summary of the site's trend.

---

## 6. Differentiating Features (the "winning" layer)

These map directly to the skill tags in the job listing and are what will separate this submission
from a purely-CRUD one. Each is scoped to be buildable in a hackathon timeframe using mocked
or lightweight real data — see TRD for implementation detail.

### 6.1 Predictive Analytics — Carbon Sequestration Forecasting (AI/ML Integration)
A lightweight regression/time-series model (e.g., linear trend + seasonal decomposition, or
`Prophet`/`statsmodels` if time allows) trained on each site's synthetic historical series, projecting
the next N periods with a confidence interval. Rendered as a dashed forecast line on the site chart.

### 6.2 Anomaly Detection → Site Health Status (AI/ML Integration + System Optimization)
An `IsolationForest` / z-score based detector runs over each site's metric series to classify the site
as *healthy / watch / at-risk*. This status directly drives the map polygon color in Story 2, tying the
ML output visibly into the core UX rather than hiding it in a side panel.

### 6.3 "Ask Darukaa" — Natural-Language Analytics Assistant (GenAI)
A chat panel on the dashboard lets the admin ask questions like *"Which sites lost the most
biodiversity score this quarter?"* The backend converts the question + relevant site/metric context
into a prompt for an LLM API (pluggable — Anthropic Claude or OpenAI, behind an interface so the
grader sees you engineered for provider-agnosticism), and returns a grounded natural-language
answer. This is **not** open-ended chit-chat — it's constrained to only ever answer from the
project's own data, which is worth explicitly stating in the README as a deliberate trade-off
(reduces hallucination risk).

### 6.4 Autonomous Monitoring Agent (Agentic AI)
A background job (Celery beat / APScheduler / cron-triggered GitHub Action hitting an endpoint)
that, on a schedule:
1. Pulls the latest metrics for every site.
2. Runs the anomaly detector (6.2).
3. For any site newly flagged *at-risk*, calls the GenAI layer to **draft a short report** ("Site X
   showed a 23% drop in NDVI over the last 3 readings, consistent with possible degradation.
   Recommend field verification.") and stores it as a Notification/Report record.
4. Surfaces these as an in-app notification feed.

This is what earns the "Agentic AI" tag honestly: it's a small, well-scoped agent loop
(observe → decide → act → report), not a marketing label on a single LLM call.

### 6.5 One-Click Funder Report (GenAI, stretch)
"Generate Report" on a project produces a shareable narrative + chart snapshot summarizing
progress — the kind of artifact a real carbon-project admin would need to send to funders.

---

## 7. Success Metrics (how you'll narrate impact in your demo/README)

- Time to create a project + first site: < 60 seconds in demo.
- Forecast/anomaly compute latency per site: < 500ms (justify caching if not).
- CI pipeline (lint + test + build) green on every PR.
- Zero manual deployment steps (push to `main` → live).

## 8. Assumptions

- Real satellite/carbon-registry data access is out of reach in hackathon time; synthetic but
  *statistically plausible* time-series (seeded per site, with injected trend + noise + occasional
  anomaly) are used and clearly documented as such.
- A single LLM provider key will be used behind an abstraction layer so the choice isn't a hard
  architectural bet.
- "Administrator" is the only real actor for v1; a `role` field on the User model future-proofs
  viewer-only accounts without over-building RBAC now.
