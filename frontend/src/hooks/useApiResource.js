import { useCallback, useEffect, useState } from "react";

import { apiClient } from "../api/axiosInstance";

export function useApiResource(path, options = {}) {
  const { enabled = true } = options;
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(enabled);

  const reload = useCallback(async () => {
    if (!enabled || !path) return null;

    setIsLoading(true);
    setError("");
    try {
      const response = await apiClient.get(path);
      setData(response);
      return response;
    } catch (err) {
      setError(err.message || "Unable to load data");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [enabled, path]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, error, isLoading, reload, setData };
}
