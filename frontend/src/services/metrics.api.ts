import { api } from "./api";
import type {
  ForecastResponse,
  MetricName,
  MetricsResponse,
  ProjectMetricsResponse,
  StatusResponse,
} from "../types/metrics";

export function getSiteMetrics(siteId: string, days = 180) {
  return api<MetricsResponse>(`/sites/${siteId}/metrics?days=${days}`);
}

export function getSiteForecast(siteId: string, metric: MetricName) {
  return api<ForecastResponse>(`/sites/${siteId}/forecast?metric=${metric}`);
}

export function getSiteStatus(siteId: string) {
  return api<StatusResponse>(`/sites/${siteId}/status`);
}

export function getProjectMetrics(projectId: string) {
  return api<ProjectMetricsResponse>(`/projects/${projectId}/metrics`);
}
