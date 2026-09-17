export type Health = "healthy" | "watch" | "at_risk";
export type ProjectType = "Carbon" | "Biodiversity" | "Both";

export interface Site {
  id: string;
  name: string;
  project: string;
  area: number;
  health: Health;
  carbon: number;
  biodiversity: number;
  ndvi: number;
  change: { carbon: number; biodiversity: number; ndvi: number };
  anomaly?: number;
  lng: number;
  lat: number;
}

export interface Project {
  id: string;
  name: string;
  type: ProjectType;
  description: string;
  sites: number;
  healthy: number;
  watch: number;
  atRisk: number;
}

// --- Live API types (Phase 1/2) ---

export interface GeoJSONPolygon {
  type: "Polygon";
  coordinates: number[][][];
}

export interface ApiProject {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  project_type: "carbon" | "biodiversity" | "both";
  start_date: string;
  created_at: string;
  site_count: number;
}

export interface ApiSite {
  id: string;
  project_id: string;
  name: string;
  area_ha: number;
  geometry: GeoJSONPolygon;
  status: Health | null;
  created_at: string;
}