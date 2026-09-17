import { useCallback, useEffect, useState } from "react";
import { generateReport, getReport, listReports, type ReportResponse } from "../services/ai.api";
import type { ReportType } from "../types/report";

export function useReports() {
  const [data, setData] = useState<ReportResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await listReports());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reports unavailable.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const generate = async (input: {
    siteId?: string;
    projectId?: string;
    reportType?: ReportType;
  }) => {
    const report = await generateReport(input);
    await reload();
    return report;
  };

  return { data, loading, error, reload, generate };
}

export function useReport(id?: string) {
  const [data, setData] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(Boolean(id));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    getReport(id)
      .then((report) => {
        if (!cancelled) setData(report);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Report unavailable");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return { data, loading, error };
}
