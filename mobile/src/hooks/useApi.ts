import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { api, ApiError } from '../api/client';
import { apiCache, clearApiCache } from '../api/cache';
import { usePageLoad } from '../store/pageLoad';

const cache = apiCache;
export { clearApiCache };

interface Options {
  /** Re-fetch silently every N ms while the screen is focused (live dashboards). */
  poll?: number;
}

/** Fetches `path` whenever the screen gains focus; exposes pull-to-refresh state and when data last synced. */
export function useApi<T>(path: string | null, options: Options = {}) {
  const hit = path ? cache.get(path) : undefined;
  const [data, setDataState] = useState<T | null>((hit?.data as T) ?? null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(hit?.at ?? null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!hit);
  const [refreshing, setRefreshing] = useState(false);
  const inFlight = useRef(false);
  const hasData = useRef(!!hit);

  // A new path (e.g. a filter change) starts from that path's cache, if any.
  const lastPath = useRef(path);
  useEffect(() => {
    if (lastPath.current === path) return;
    lastPath.current = path;
    const next = path ? cache.get(path) : undefined;
    setDataState((next?.data as T) ?? null);
    setUpdatedAt(next?.at ?? null);
    hasData.current = !!next;
    setLoading(!next);
  }, [path]);

  // The page loader shows while an open screen fetches its very first data (not on refreshes or polls)
  const loaderId = useId();
  const everLoaded = useRef(!!hit);
  const load = useCallback(
    async (mode: 'focus' | 'refresh' | 'poll' = 'focus') => {
      if (!path || (mode === 'poll' && inFlight.current)) return;
      inFlight.current = true;
      // Only before this screen has shown anything at all (a filter change inside an open page does not count)
      const first = mode === 'focus' && !everLoaded.current;
      if (first) usePageLoad.getState().start(loaderId);
      if (mode === 'refresh') setRefreshing(true);
      else if (mode === 'focus' && !hasData.current) setLoading(true);
      try {
        const res = await api<T>(path);
        const at = Date.now();
        cache.set(path, { data: res, at });
        hasData.current = true;
        setDataState(res);
        setUpdatedAt(at);
        setError(null);
      } catch (e) {
        // A failed background poll keeps showing the last good data
        // With no signal, keep showing the saved data instead of an error
        const offline = e instanceof ApiError && e.code === 'NETWORK';
        if (offline && hasData.current) return;
        if (mode !== 'poll' || !hasData.current) setError(e instanceof ApiError ? e.message : 'Something went wrong');
      } finally {
        everLoaded.current = true;
        if (first) usePageLoad.getState().done(loaderId);
        inFlight.current = false;
        setLoading(false);
        setRefreshing(false);
      }
    },
    [path, loaderId],
  );

  useFocusEffect(
    useCallback(() => {
      void load();
      if (!options.poll) return;
      const t = setInterval(() => void load('poll'), options.poll);
      return () => clearInterval(t);
    }, [load, options.poll]),
  );

  useEffect(() => () => usePageLoad.getState().done(loaderId), [loaderId]);

  const setData = useCallback(
    (v: T | null | ((prev: T | null) => T | null)) => {
      setDataState((prev) => {
        const next = typeof v === 'function' ? (v as (p: T | null) => T | null)(prev) : v;
        if (path && next) cache.set(path, { data: next, at: Date.now() });
        return next;
      });
    },
    [path],
  );

  return { data, error, loading, refreshing, updatedAt, reload: () => load('focus'), refresh: () => load('refresh'), setData };
}
