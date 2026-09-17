import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { SiteDetail } from "./SiteDetail";

const site = {
  id: "site-1",
  project_id: "project-1",
  name: "Amazon Site 04",
  area_ha: 842.42,
  geometry: {
    type: "Polygon" as const,
    coordinates: [
      [
        [0, 0],
        [0.01, 0],
        [0.01, 0.01],
        [0, 0.01],
        [0, 0],
      ],
    ],
  },
  status: "at_risk" as const,
  created_at: "2026-01-01T00:00:00Z",
};

const useSite = vi.fn();
const useSiteStatus = vi.fn();
const useMetrics = vi.fn();
const useForecast = vi.fn();

vi.mock("../hooks/useSites", () => ({ useSite: () => useSite() }));
vi.mock("../hooks/useProjects", () => ({
  usePortfolio: () => ({
    data: { projects: [{ id: "project-1", name: "Amazon Restoration" }], sites: [] },
    loading: false,
    error: null,
    reload: vi.fn(),
  }),
}));
vi.mock("../hooks/useMetrics", () => ({
  useMetrics: () => useMetrics(),
  useForecast: () => useForecast(),
  useSiteStatus: () => useSiteStatus(),
}));
vi.mock("../components/charts/EnvironmentalChart", () => ({
  EnvironmentalChart: () => <div data-testid="chart" />,
}));
vi.mock("../services/ai.api", () => ({ generateReport: vi.fn() }));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/app/sites/site-1"]}>
      <Routes>
        <Route path="/app/sites/:siteId" element={<SiteDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  useSite.mockReturnValue({ data: site, loading: false, error: null, reload: vi.fn() });
  useSiteStatus.mockReturnValue({
    data: {
      site_id: "site-1",
      status: "at_risk",
      anomaly_score: 0.87,
      last_evaluated_at: "2026-09-17T10:00:00Z",
      reasons: ["NDVI has declined versus the recent baseline"],
    },
    loading: false,
    error: null,
    reload: vi.fn(),
  });
  useMetrics.mockReturnValue({
    data: {
      site_id: "site-1",
      range_days: 180,
      points: [
        { recorded_at: "2026-09-17", carbon_tco2e: 4821, biodiversity_index: 72.4, ndvi: 0.68 },
      ],
    },
    loading: false,
    error: null,
    reload: vi.fn(),
  });
  useForecast.mockReturnValue({
    data: { model: "Linear trend regression", confidence: 0.95, forecast: [], historical: [] },
    loading: false,
    error: null,
    reload: vi.fn(),
  });
});

describe("SiteDetail — Story 3", () => {
  it("shows the site name, project and PostGIS-computed area", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "Amazon Site 04" })).toBeInTheDocument();
    expect(screen.getByText(/Amazon Restoration/)).toBeInTheDocument();
    expect(screen.getAllByText(/842\.42/).length).toBeGreaterThan(0);
  });

  it("renders the anomaly banner with the model's score and its reason", () => {
    renderPage();
    expect(screen.getByText(/site health: at risk/i)).toBeInTheDocument();
    expect(screen.getByText(/NDVI has declined/i)).toBeInTheDocument();
    expect(screen.getByText(/0\.87/)).toBeInTheDocument();
  });

  it("surfaces the latest metric values as KPIs", () => {
    renderPage();
    expect(screen.getByText("4,821")).toBeInTheDocument();
    expect(screen.getByText("72.4")).toBeInTheDocument();
    expect(screen.getByText("0.680")).toBeInTheDocument();
  });

  it("states the forecast horizon and confidence level", () => {
    renderPage();
    expect(screen.getByText(/6 future\s+periods/i)).toBeInTheDocument();
    expect(screen.getByText(/95% confidence interval/i)).toBeInTheDocument();
  });

  it("hides the health banner for a healthy site", () => {
    useSiteStatus.mockReturnValue({
      data: {
        site_id: "site-1",
        status: "healthy",
        anomaly_score: 0.12,
        last_evaluated_at: "2026-09-17T10:00:00Z",
        reasons: [],
      },
      loading: false,
      error: null,
      reload: vi.fn(),
    });
    renderPage();
    expect(screen.queryByText(/site health:/i)).not.toBeInTheDocument();
  });

  it("shows a recoverable error state when the site cannot be loaded", () => {
    useSite.mockReturnValue({ data: null, loading: false, error: "Site not found", reload: vi.fn() });
    renderPage();
    expect(screen.getByText(/site could not be loaded/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /back to sites/i })).toBeInTheDocument();
  });
});
