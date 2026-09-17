import { useCallback, useEffect, useState } from "react";
import { getSite } from "../services/sites.api";
import type { ApiSite } from "../types";

export function useSite(siteId?: string) {
  const [data, setData] = useState<ApiSite | null>(null);
  const [loading, setLoading] = useState(Boolean(siteId));
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!siteId) return;
    setLoading(true);
    setError(null);
    try {
      setData(await getSite(siteId));
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : "Unable to load site.");
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  useEffect(() => { void reload(); }, [reload]);
  return { data, loading, error, reload };
}
