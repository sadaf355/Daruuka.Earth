import { useCallback, useState } from "react";
import { askDarukaa, type AssistantResponse } from "../services/ai.api";

export function useAssistant() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ask = useCallback(async (question: string, siteId?: string, projectId?: string) => {
    setLoading(true);
    setError(null);
    try {
      return (await askDarukaa(question, siteId, projectId)) as AssistantResponse;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Assistant unavailable");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { ask, loading, error };
}
