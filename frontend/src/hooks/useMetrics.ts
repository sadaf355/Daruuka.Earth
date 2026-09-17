import { useCallback, useEffect, useState } from "react";
import {
  getProjectMetrics,
  getSiteForecast,
  getSiteMetrics,
  getSiteStatus,
} from "../services/metrics.api";
import type {
  ForecastResponse,
  MetricName,
  MetricsResponse,
  ProjectMetricsResponse,
  StatusResponse,
} from "../types/metrics";

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

function message(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

export function useMetrics(siteId?: string, days = 180): AsyncState<MetricsResponse> {
  const [data, setData] = useState<MetricsResponse | null>(null);
  const [loading, setLoading] = useState(Boolean(siteId));
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!siteId) return;
    setLoading(true);
    setError(null);
    try {
      setData(await getSiteMetrics(siteId, days));
    } catch (err) {
      setError(message(err));
    } finally {
      setLoading(false);
    }
  }, [siteId, days]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, loading, error, reload };
}

export function useForecast(
  siteId?: string,
  metric: MetricName = "ndvi",
): AsyncState<ForecastResponse> {
  const [data, setData] = useState<ForecastResponse | null>(null);
  const [loading, setLoading] = useState(Boolean(siteId));
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!siteId) return;
    setLoading(true);
    setError(null);
    try {
      setData(await getSiteForecast(siteId, metric));
    } catch (err) {
      setError(message(err));
    } finally {
      setLoading(false);
    }
  }, [siteId, metric]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, loading, error, reload };
}

export function useSiteStatus(siteId?: string): AsyncState<StatusResponse> {
  const [data, setData] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(Boolean(siteId));
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!siteId) return;
    setLoading(true);
    setError(null);
    try {
      setData(await getSiteStatus(siteId));
    } catch (err) {
      setError(message(err));
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, loading, error, reload };
}

export function useProjectMetrics(projectId?: string): AsyncState<ProjectMetricsResponse> {
  const [data, setData] = useState<ProjectMetricsResponse | null>(null);
  const [loading, setLoading] = useState(Boolean(projectId));
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      setData(await getProjectMetrics(projectId));
    } catch (err) {
      setError(message(err));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, loading, error, reload };
}
