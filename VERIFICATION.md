# Verification Guide

How to confirm every layer of Darukaa.Earth is genuinely working — not just rendering.

Work through it in order. Each step lists **what to do**, **what you should see**, and **how to
prove it's real** rather than a hardcoded mock.

---

## Part 0 — Automated checks (5 minutes)

Run these first. If they pass, the logic underneath the UI is sound.

### 0.1 Backend unit tests — no database required

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
pytest -m "not integration" -v
```

**Expect:** all tests pass. These cover anomaly thresholds, forecast shape and confidence bands,
the area SQL, JWT access/refresh separation, and the grounded GenAI provider.

### 0.2 Backend linting — proves the pre-commit hooks won't fail

```bash
cd backend
ruff check .          # expect: "All checks passed!"
black --check .       # expect: "All done!" with no files reformatted
```

### 0.3 Backend integration tests — needs a live database

```bash
docker-compose up -d db
cd backend
alembic upgrade head
pytest -m integration -v
```

**Expect:** all pass. If you see `SKIPPED (No Postgres+PostGIS reachable)`, the database isn't up
or `DATABASE_URL` is wrong — the tests are telling you the truth, fix that before continuing.

This suite is the real proof of Story 1: it registers a user, logs in, creates a project, POSTs a
drawn polygon, and asserts PostGIS computed a sensible hectare value. It also asserts a second
user gets a `404` on the first user's site.

### 0.4 Frontend

```bash
cd frontend
npm install        # regenerates package-lock.json — commit it; the old lock predates the test deps
npm test           # Vitest — expect all suites passing
npm run lint       # ESLint — expect no errors
npm run build      # tsc -b && vite build — expect a dist/ folder, no type errors
```

---

## Part 1 — Get it running

```bash
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# Put a real Mapbox public token in the ROOT .env as VITE_MAPBOX_TOKEN
docker-compose up --build
```

### Checkpoint 1.1 — the stack is alive

| Check | URL | Expected |
|---|---|---|
| API liveness | http://localhost:8000/health | `{"status":"ok"}` |
| API docs | http://localhost:8000/docs | Swagger UI listing every router |
| Frontend | http://localhost:5173 | Redirects to `/login` |

### Checkpoint 1.2 — PostGIS is actually enabled

```bash
docker-compose exec db psql -U darukaa -d darukaa -c "SELECT PostGIS_Version();"
```

**Expect:** a version string. If this errors, the geospatial layer cannot work — stop here.

### Checkpoint 1.3 — migrations applied

```bash
docker-compose exec db psql -U darukaa -d darukaa -c "\dt"
```

**Expect:** `users`, `projects`, `sites`, `site_metrics`, `site_status`, `reports`,
`notifications`, `alembic_version`.

---

## Part 2 — Auth (Story 1 prerequisite)

1. Go to http://localhost:5173 → you're redirected to `/login`.
2. Click **Register**, create an account (password must be 8–128 characters).
3. You're signed in and land on the dashboard.

**Checkpoint 2.1 — tokens are real.** Open DevTools → Application → Local Storage. You should see
`darukaa_token` and `darukaa_refresh_token`. Paste the access token into
[jwt.io](https://jwt.io) — the payload should contain `sub`, `exp` and `"type": "access"`.

**Checkpoint 2.2 — the session survives a refresh.** Hard-refresh the page. You stay signed in.
This proves `/auth/me` session restoration works rather than the app trusting a stale flag.

**Checkpoint 2.3 — routes are actually protected.** Sign out, then navigate directly to
`http://localhost:5173/app/dashboard`. You're bounced to `/login`.

**Checkpoint 2.4 — the API rejects anonymous calls.**

```bash
curl -i http://localhost:8000/projects
```

**Expect:** `401` or `403`, never a project list.

---

## Part 3 — Story 1: create a project and draw sites

1. Click **+ New Project** (or go to `/app/projects/new`).
2. Name it `Amazon Restoration Initiative`, pick type **Both**, click **Continue**.
3. You advance to step 2 with a drawing-enabled map.
4. Click points on the map to draw a polygon, then close the loop.
5. Name the site `Site 01` and click **+ Add another site**, then **Save sites**.

### Checkpoint 3.1 — area is computed live while drawing
As you close the polygon, the **area panel** updates immediately with a hectare value. The label
says it's a client-side preview.

### Checkpoint 3.2 — the saved area came from PostGIS, not the browser
This is the important one. After saving, query the database directly:

```bash
docker-compose exec db psql -U darukaa -d darukaa -c \
  "SELECT name, area_ha, ST_Area(ST_Transform(geom,3857))/10000 AS recomputed, ST_SRID(geom) FROM sites;"
```

**Expect:** `area_ha` matches `recomputed`, and `st_srid` is `4326`. The browser preview is only
a preview — the persisted number is Postgres's.

### Checkpoint 3.3 — the geometry round-trips
```bash
docker-compose exec db psql -U darukaa -d darukaa -c \
  "SELECT name, ST_GeometryType(geom) FROM sites;"
```

**Expect:** `ST_Polygon`.

### Checkpoint 3.4 — target under 60 seconds
Time yourself from clicking **New Project** to seeing the site saved. The PRD's demo target is
under a minute.

---

## Part 4 — Story 2: the portfolio map

Go to `/app/dashboard`.

### Checkpoint 4.1 — polygons render from saved data
Your drawn site appears as a filled, outlined polygon. It's read back from the API as GeoJSON,
not remembered client-side — **hard-refresh the page** and it's still there.

### Checkpoint 4.2 — colour is driven by the ML model
Polygon fill is green / amber / red. Cross-check it against the database:

```bash
docker-compose exec db psql -U darukaa -d darukaa -c \
  "SELECT s.name, st.status, st.anomaly_score, st.last_evaluated_at FROM sites s JOIN site_status st ON st.site_id = s.id;"
```

**Expect:** the colour on the map matches `status` for that row. This is where "Data
Visualization" and "AI/ML Integration" actually meet — the model output *is* the UI.

### Checkpoint 4.3 — clustering
Zoom out past zoom level 7. Polygons are replaced by teal circles with a count. Click one — the
map eases in and expands the cluster. Zoom back in past 7 and the boundaries return.

> With only one or two sites you'll see individual dots rather than a cluster bubble. Create a
> few sites in different parts of the world to see grouping properly.

### Checkpoint 4.4 — basemap toggle
Click the layers button in the map controls. The basemap switches to satellite, **and your
polygons are still drawn on top** — this is the part that usually breaks, because a Mapbox style
change drops all custom layers. They're re-added on `style.load`.

### Checkpoint 4.5 — site popup
Click a polygon. A popup shows name, project, area and health, with a **View site →** button that
navigates to the detail page.

### Checkpoint 4.6 — project filtering
Use the project list in the left panel to filter. Only that project's sites remain.

---

## Part 5 — Story 3: site analytics

Click a site → `/app/sites/:siteId`.

### Checkpoint 5.1 — time series is real
Three metric tabs (Carbon / Biodiversity / NDVI) each render a chart. Confirm the data is coming
from the API, not a fixture:

```bash
docker-compose exec db psql -U darukaa -d darukaa -c \
  "SELECT COUNT(*), MIN(recorded_at), MAX(recorded_at) FROM site_metrics;"
```

**Expect:** ~180 rows per site spanning 180 days. Compare the last `carbon_tco2e` value against
the **Carbon** KPI card on the page — they should match.

### Checkpoint 5.2 — the forecast overlay
Each chart shows a dashed forecast line extending past the historical data, with a shaded
confidence band. Below it: *"ML forecast connected · 6 future periods · 95% confidence interval ·
Linear trend regression."*

Verify the numbers directly (get a token first — see Part 8):

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/sites/$SITE_ID/forecast?metric=carbon" | python3 -m json.tool
```

**Expect:** exactly 6 objects under `forecast`, each with `lower <= value <= upper`, and the band
**widening** with each period.

### Checkpoint 5.3 — the anomaly banner
If the site is `watch` or `at_risk`, a coloured banner appears with the score and a plain-English
reason ("NDVI has declined versus the recent baseline"). A `healthy` site shows no banner at all
— that's correct, not a bug.

### Checkpoint 5.4 — the boundary map
The "Saved monitoring boundary" card renders your actual polygon on a small map, with the
PostGIS-computed hectare figure beneath it.

### Checkpoint 5.5 — caching works
Reload the page twice and watch the backend logs. The second load should be noticeably faster —
evaluation is cached for 5 minutes and forecasts for an hour.

---

## Part 6 — Ask Darukaa (GenAI)

From the site page, click **Ask Darukaa about this site**.

### Checkpoint 6.1 — context is carried through
The URL contains `?siteId=…&projectId=…` and the **Live context** strip names the actual project,
site and status. The assistant opens already scoped to where you came from.

### Checkpoint 6.2 — answers are grounded in real values
Ask: *"Why is this site at risk?"*

**Expect:** the answer names **your** site, quotes the **actual** anomaly score, and repeats the
**actual** NDVI / biodiversity / carbon values. Cross-check them against the KPI cards — they
must match exactly.

### Checkpoint 6.3 — it reports its own provenance
Under each answer is the provider and model, e.g. `grounded-fallback · darukaa-context-v1`. You
can always tell what produced an answer.

### Checkpoint 6.4 — it can't reach outside your data
Ask: *"What's the weather in Tokyo?"* or *"Tell me about Site 999."*

**Expect:** it redirects to what it actually knows. It must not invent a site, a metric or a
number. This is the anti-hallucination constraint working.

### Checkpoint 6.5 — ownership is enforced before the AI is called
```bash
curl -s -X POST http://localhost:8000/assistant/query \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"question":"status?","site_id":"00000000-0000-0000-0000-000000000000"}'
```

**Expect:** `404 Site not found` — the ownership check runs *before* any model call.

### Checkpoint 6.6 — optional: swap in a real LLM
Put `LLM_PROVIDER=gemini` and a `GEMINI_API_KEY` in the root `.env`, then
`docker-compose up -d --force-recreate backend`. Ask the same question. The answer is now fluent
prose and the provenance line reads `gemini · gemini-2.0-flash` — **through the same interface,
with no other code change.** That's the provider abstraction doing its job.

---

## Part 7 — Agent and reports (Agentic AI)

### Checkpoint 7.1 — on-demand sweep
Go to `/app/monitoring` and click **Run evaluation now**.

**Expect:** a result line — *"N sites evaluated · X healthy · Y watch · Z at risk · A alerts · B
reports."*

### Checkpoint 7.2 — it creates durable artifacts, not log lines
```bash
docker-compose exec db psql -U darukaa -d darukaa -c \
  "SELECT severity, message, created_at FROM notifications ORDER BY created_at DESC LIMIT 5;"
docker-compose exec db psql -U darukaa -d darukaa -c \
  "SELECT report_type, generated_by, generated_at FROM reports ORDER BY generated_at DESC LIMIT 5;"
```

**Expect:** rows with `report_type = agent_alert` and `generated_by = system`.

### Checkpoint 7.3 — it alerts on transitions, not on state
Click **Run evaluation now** a second time immediately.

**Expect:** `alerts_created: 0`. Nothing changed status, so nothing re-alerts. A site that's been
at risk for a week must not spam you every sweep. *(This is the single best thing to point at
when someone asks how this differs from a cron job.)*

### Checkpoint 7.4 — the scheduled sweep runs unattended
The compose file sets `AGENT_INTERVAL_SECONDS=120`. Leave the app open for ~2 minutes without
touching anything, then:

```bash
docker-compose logs backend | grep "Agent sweep"
```

**Expect:** `Agent sweep complete for N user(s)`, repeating. This is the agent working with no
human in the loop.

### Checkpoint 7.5 — alerts reach the UI
The topbar bell shows an unread count. Click it — a drawer lists recent alerts. Click one to mark
it read; the count drops. `/app/alerts` supports All / Critical / Warning / Read filters.

### Checkpoint 7.6 — report generation
From a site page click **Generate Report**. You land on a report document with an executive
summary, current signals, key findings and a recommendation. **Print / Save PDF** opens the
browser print dialog.

Confirm it persisted:
```bash
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8000/reports | python3 -m json.tool
```

---

## Part 8 — API-only verification

Get a token:

```bash
BASE=http://localhost:8000

curl -s -X POST $BASE/auth/register -H "Content-Type: application/json" \
  -d '{"email":"verify@darukaa.earth","password":"verify-password-123"}'

TOKEN=$(curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" \
  -d '{"email":"verify@darukaa.earth","password":"verify-password-123"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])")

echo $TOKEN
```

Walk the whole flow:

```bash
# Create a project
PROJECT=$(curl -s -X POST $BASE/projects -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"API Verify","project_type":"both","start_date":"2026-01-01"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])")

# Create a site from a polygon
SITE=$(curl -s -X POST $BASE/projects/$PROJECT/sites -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"API Site","geometry":{"type":"Polygon","coordinates":[[[-60,0],[-59.99,0],[-59.99,0.01],[-60,0.01],[-60,0]]]}}' \
  | python3 -m json.tool)
echo "$SITE"        # check area_ha is populated and non-zero

SITE_ID=$(echo "$SITE" | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])")

# ML layer
curl -s -H "Authorization: Bearer $TOKEN" "$BASE/sites/$SITE_ID/status"   | python3 -m json.tool
curl -s -H "Authorization: Bearer $TOKEN" "$BASE/sites/$SITE_ID/forecast?metric=ndvi" | python3 -m json.tool

# GenAI layer
curl -s -X POST $BASE/assistant/query -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"question\":\"Why is this site at risk?\",\"site_id\":\"$SITE_ID\"}" | python3 -m json.tool

# Agent layer
curl -s -X POST $BASE/monitoring/run -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

### Checkpoint 8.1 — refresh-token rotation
```bash
REFRESH=$(curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" \
  -d '{"email":"verify@darukaa.earth","password":"verify-password-123"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['refresh_token'])")

curl -s -X POST $BASE/auth/refresh -H "Content-Type: application/json" \
  -d "{\"refresh_token\":\"$REFRESH\"}" | python3 -m json.tool
```

**Expect:** a fresh access/refresh pair.

### Checkpoint 8.2 — a refresh token can't open the API
```bash
curl -i -H "Authorization: Bearer $REFRESH" $BASE/projects
```

**Expect:** `401`. Token-type confusion is the classic JWT bug; this proves it's guarded.

### Checkpoint 8.3 — cross-user isolation
Register a second user, get their token, and request the first user's site.

**Expect:** `404` — not `403`. The API doesn't leak the existence of resources you can't see.

---

## Part 9 — Pre-commit hooks

```bash
npm install
pip install pre-commit && pre-commit install --install-hooks
```

**Checkpoint 9.1 — the frontend hook fires.** Introduce an obvious lint error (an unused import)
in a `.tsx` file, stage it, and commit. Husky runs `lint-staged`, ESLint auto-fixes or the commit
is blocked.

**Checkpoint 9.2 — the backend hook fires.** Badly format a `.py` file (collapse a function onto
one long line), stage it, and commit. Black reformats it and the commit is blocked so you can
re-stage.

**Checkpoint 9.3 — no hook conflict.**
```bash
git config core.hooksPath
```
**Expect:** `.husky`. Both toolchains run because `pre-commit` is invoked from inside the Husky
hook rather than installing a competing one into `.git/hooks`.

---

## Part 10 — The two-minute demo path

Once everything above passes, this is the narrative to walk someone through:

| # | Action | What it proves |
|---|---|---|
| 1 | Land on the dashboard — portfolio map, KPIs, health legend | Story 2 |
| 2 | **New Project** → name it → **Continue** | Story 1 |
| 3 | Draw a polygon → area appears live → **Save sites** | Story 1 + geospatial |
| 4 | Site appears on the map, coloured by health | ML output driving the UI |
| 5 | Click it → detail page with three metric tabs | Story 3 |
| 6 | Show the forecast line and confidence band | AI/ML integration |
| 7 | Point at the anomaly banner and its score | Anomaly detection |
| 8 | **Ask Darukaa** → *"Why is this site at risk?"* → answer quotes real numbers | GenAI, grounded |
| 9 | **Generate Report** → narrative document | GenAI applied to a real deliverable |
| 10 | `/app/monitoring` → **Run evaluation now** → alert appears in the bell | Agentic AI |

The arc: **Map → Data → ML → AI → Agent.** One coherent story, not a feature list.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Map shows "Mapbox is not configured" | No token | Put `VITE_MAPBOX_TOKEN` in the **root** `.env` and restart compose |
| Map area is blank/grey | Invalid or restricted token | Check for a 401 from Mapbox in the browser console |
| `401` on every API call | Expired token, or backend restarted with a new `SECRET_KEY` | Sign out and back in |
| CORS errors in the console | Frontend origin not allowed | Add it to `CORS_ORIGINS` in `backend/.env` and restart |
| Charts empty | No metric history | Run `python scripts/seed_metrics.py` from `backend/` |
| Every site shows healthy | Normal — the disturbance window may not be in the recent tail | Run a monitoring sweep; create several sites, since the series is seeded from the site UUID |
| Integration tests all skip | No database reachable | `docker-compose up -d db && alembic upgrade head` |
| `pytest` can't import `app` | Wrong working directory | Run from `backend/`; `pythonpath = ["."]` is set in `pyproject.toml` |
| `alembic upgrade head` fails on `geometry` | PostGIS extension missing | Use the `postgis/postgis:15-3.4` image, not plain `postgres` |
| Agent never logs a sweep | `AGENT_ENABLED=false`, or under 60s elapsed | Interval is floored at 60s regardless of config |
