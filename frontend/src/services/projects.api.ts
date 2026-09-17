import type { ApiProject } from "../types";
import { api } from "./api";
import type { ApiSite } from "../types";

export interface CreateProjectPayload {
  name: string;
  description?: string;
  project_type: "carbon" | "biodiversity" | "both";
  start_date: string;
}

export function listProjects(): Promise<ApiProject[]> {
  return api<ApiProject[]>("/projects");
}

export function createProject(payload: CreateProjectPayload): Promise<ApiProject> {
  return api<ApiProject>("/projects", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getProject(projectId: string): Promise<ApiProject> {
  return api<ApiProject>(`/projects/${projectId}`);
}

export function listProjectSites(projectId: string): Promise<ApiSite[]> {
  return api<ApiSite[]>(`/projects/${projectId}/sites`);
}
