import { api } from "./api";

export interface MonitoringRun {
  evaluated: number;
  alerts_created: number;
  reports_created: number;
  at_risk: number;
  watch: number;
  healthy: number;
}

export function runMonitoring() {
  return api<MonitoringRun>("/monitoring/run", { method: "POST" });
}
