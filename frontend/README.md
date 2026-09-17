# Darukaa.Earth — Frontend

React 19 + TypeScript + Vite SPA for the Darukaa.Earth geospatial workspace.

See the [root README](../README.md) for the full architecture, setup and verification guide.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server on http://localhost:5173 |
| `npm run build` | Type-check (`tsc -b`) then production build |
| `npm run lint` | ESLint over the whole `src` tree |
| `npm run format` | Prettier write pass |
| `npm test` | Vitest run (jsdom + React Testing Library) |

## Environment

Copy `.env.example` to `.env` and set:

- `VITE_API_URL` — backend base URL, no trailing slash
- `VITE_MAPBOX_TOKEN` — a public Mapbox token; without it the map renders a configuration
  notice instead of crashing

## Structure

```
src/
├── components/
│   ├── charts/    EnvironmentalChart (Chart.js line + forecast + confidence band)
│   ├── layout/    AppShell (sidebar, topbar, notification drawer)
│   ├── map/       PortfolioMap (Mapbox GL, Draw, clustering, health colouring)
│   └── ui.tsx     HealthBadge, Kpi, SectionHeader, Button
├── hooks/         useAuth, useProjects, useSites, useMetrics, useAssistant, useNotifications, useReports
├── pages/         One component per route
├── services/      Typed fetch wrappers; the only place that talks to the API
├── store/         Lightweight subscribable stores (auth, project, map)
├── types/         Shared API/domain types
└── utils/         geo (turf), formatters
```

UI components never call `fetch` directly — they go through `hooks/` → `services/` → API, which
mirrors the backend's router → service → model layering.
