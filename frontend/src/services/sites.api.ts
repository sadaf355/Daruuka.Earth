import type { ApiSite, GeoJSONPolygon } from "../types";
import { api } from "./api";

export function createSite(projectId: string, name: string, geometry: GeoJSONPolygon): Promise<ApiSite> {
  return api<ApiSite>(`/projects/${projectId}/sites`, {
    method: "POST",
    body: JSON.stringify({ name, geometry }),
  });
}

export function listProjectSites(projectId: string): Promise<ApiSite[]> {
  return api<ApiSite[]>(`/projects/${projectId}/sites`);
}

export function getSite(siteId: string): Promise<ApiSite> {
  return api<ApiSite>(`/sites/${siteId}`);
}
