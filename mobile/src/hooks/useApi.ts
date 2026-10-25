import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { api, ApiError } from '../api/client';

/** Fetches `path` whenever the screen gains focus; exposes pull-to-refresh state. */
export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!path) return;
      isRefresh ? setRefreshing(true) : setLoading(true);
      try {
        setData(await api<T>(path));
        setError(null);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Something went wrong');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [path],
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return { data, error, loading, refreshing, reload: load, refresh: () => load(true), setData };
}
