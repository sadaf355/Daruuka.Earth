export type ApiProjectType = "carbon" | "biodiversity" | "both";

export interface ProjectSummary {
  id: string;
  name: string;
  project_type: ApiProjectType;
  site_count: number;
}
