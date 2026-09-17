import { api } from "./api";
import type { ReportType } from "../types/report";

export interface AssistantResponse {
  answer: string;
  provider: string;
  model: string;
  context: Record<string, unknown>;
  sources: string[];
}

export interface ReportResponse {
  id: string;
  project_id: string | null;
  site_id: string | null;
  report_type: string;
  content: string;
  generated_at: string;
  generated_by: string;
}

export function askDarukaa(question: string, siteId?: string, projectId?: string) {
  return api<AssistantResponse>("/assistant/query", {
    method: "POST",
    body: JSON.stringify({ question, site_id: siteId, project_id: projectId }),
  });
}

export function generateReport(input: {
  siteId?: string;
  projectId?: string;
  reportType?: ReportType;
}) {
  return api<ReportResponse>("/reports/generate", {
    method: "POST",
    body: JSON.stringify({
      site_id: input.siteId,
      project_id: input.projectId,
      report_type: input.reportType ?? "ai_summary",
    }),
  });
}

export function listReports() {
  return api<ReportResponse[]>("/reports");
}

export function getReport(id: string) {
  return api<ReportResponse>(`/reports/${id}`);
}
