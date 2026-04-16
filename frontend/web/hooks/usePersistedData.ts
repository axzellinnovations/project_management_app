'use client';

/**
 * usePersistedData — stale-while-revalidate cache that persists in localStorage
 * until the user logs out. Syncs in the background every `syncIntervalMs` ms.
 *
 * Cache entries are keyed by a user-scoped token, so different users on the
 * same device never share data. clearAllSessionCacheData() is called on logout.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  buildSessionCacheKey,
  getSessionCache,
  setSessionCache,
} from '@/lib/session-cache';

interface UsePersistedDataOptions<T> {
  /** Unique page / feature identifier e.g. 'kanban-board' */
  cacheKey: string;
  /** Additional scope parts (e.g. projectId, roomId) */
  scope?: Array<string | number | null | undefined>;
  /** The async function that fetches fresh data */
  fetcher: () => Promise<T>;
  /** How long before cache is considered stale (default 60s) */
  ttlMs?: number;
  /** How often to silently re-fetch in the background (default 30s). Set 0 to disable. */
  syncIntervalMs?: number;
  /** Whether to skip fetching entirely */
  skip?: boolean;
}

interface UsePersistedDataResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function usePersistedData<T>({
  cacheKey,
  scope = [],
  fetcher,
  ttlMs = 60_000,
  syncIntervalMs = 30_000,
  skip = false,
}: UsePersistedDataOptions<T>): UsePersistedDataResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const getKey = useCallback(() => {
    return buildSessionCacheKey(cacheKey, scope);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, ...scope]);

  const fetchAndCache = useCallback(async (showLoading = false) => {
    const key = getKey();
    if (!key) return;
    if (showLoading) setLoading(true);
    try {
      const fresh = await fetcherRef.current();
      setData(fresh);
      setError(null);
      setSessionCache(key, fresh, ttlMs);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load data';
      // Only surface the error if we have nothing cached yet
      setError((prev) => (data === null ? msg : prev));
    } finally {
      if (showLoading) setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getKey, ttlMs]);

  // Initial load: serve cache instantly, then revalidate
  useEffect(() => {
    if (skip) { setLoading(false); return; }

    const key = getKey();
    if (!key) { setLoading(false); return; }

    const cached = getSessionCache<T>(key, { allowStale: true });
    if (cached.data !== null) {
      setData(cached.data);
      setLoading(false);
      // Revalidate silently if stale
      if (cached.isStale) void fetchAndCache(false);
    } else {
      void fetchAndCache(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skip, getKey]);

  // Background sync
  useEffect(() => {
    if (skip || syncIntervalMs <= 0) return;
    const id = setInterval(() => void fetchAndCache(false), syncIntervalMs);
    return () => clearInterval(id);
  }, [skip, syncIntervalMs, fetchAndCache]);

  const refresh = useCallback(() => fetchAndCache(true), [fetchAndCache]);

  return { data, loading, error, refresh };
}
