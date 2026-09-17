export type MetricName = "carbon" | "biodiversity" | "ndvi";
export interface SiteMetricPoint { recorded_at: string; carbon_tco2e: number; biodiversity_index: number; ndvi: number; }
export interface MetricsResponse { site_id: string; range_days: number; points: SiteMetricPoint[]; }
export interface ForecastPoint { recorded_at: string; value: number; lower: number; upper: number; }
export interface ForecastResponse { site_id: string; metric: MetricName; historical: ForecastPoint[]; forecast: ForecastPoint[]; model: string; confidence: number; }
export interface StatusResponse { site_id: string; status: "healthy" | "watch" | "at_risk"; anomaly_score: number; last_evaluated_at: string; reasons: string[]; }
export interface ProjectMetricSummary { site_id: string; site_name: string; health: "healthy" | "watch" | "at_risk"; anomaly_score: number; latest: SiteMetricPoint; changes: { carbon: number; biodiversity: number; ndvi: number }; }
export interface ProjectMetricsResponse { project_id: string; sites: ProjectMetricSummary[]; portfolio_points: SiteMetricPoint[]; }
