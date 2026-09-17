import { useCallback, useEffect, useState } from "react";
import { createProject, getProject, listProjectSites, listProjects, type CreateProjectPayload } from "../services/projects.api";
import type { ApiProject, ApiSite } from "../types";

interface AsyncState<T> {
  data: T;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

function message(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

export function useProjects(): AsyncState<ApiProject[]> {
  const [data, setData] = useState<ApiProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await listProjects());
    } catch (err) {
      setError(message(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);
  return { data, loading, error, reload };
}

export function useProject(projectId?: string): AsyncState<ApiProject | null> {
  const [data, setData] = useState<ApiProject | null>(null);
  const [loading, setLoading] = useState(Boolean(projectId));
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      setData(await getProject(projectId));
    } catch (err) {
      setData(null);
      setError(message(err));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { void reload(); }, [reload]);
  return { data, loading, error, reload };
}

export function useProjectSites(projectId?: string): AsyncState<ApiSite[]> {
  const [data, setData] = useState<ApiSite[]>([]);
  const [loading, setLoading] = useState(Boolean(projectId));
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      setData(await listProjectSites(projectId));
    } catch (err) {
      setData([]);
      setError(message(err));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { void reload(); }, [reload]);
  return { data, loading, error, reload };
}

export function usePortfolio(): AsyncState<{ projects: ApiProject[]; sites: Array<ApiSite & { projectName: string }> }> {
  const [data, setData] = useState<{ projects: ApiProject[]; sites: Array<ApiSite & { projectName: string }> }>({ projects: [], sites: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const projects = await listProjects();
      const grouped = await Promise.all(projects.map(async (project) => {
        const sites = await listProjectSites(project.id);
        return sites.map((site) => ({ ...site, projectName: project.name }));
      }));
      setData({ projects, sites: grouped.flat() });
    } catch (err) {
      setError(message(err));
      setData({ projects: [], sites: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);
  return { data, loading, error, reload };
}

export async function submitProject(payload: CreateProjectPayload) {
  return createProject(payload);
}
