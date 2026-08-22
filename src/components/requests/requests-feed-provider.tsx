'use client';

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { api, ApiError } from '@/lib/api';
import type {
  RequestBoardCounts,
  RequestBoardResponse,
  TenantRequestView,
} from '@/lib/types';
import { useTenant } from '../tenant-provider';
import { mergeBoardDelta } from './board-logic';

/**
 * ONE poller for the whole dashboard (spec note 4): the nav badge and the
 * board read the same feed, so opening the board never double-fetches. The
 * board "boosts" the poll to its fast interval while mounted; elsewhere the
 * feed idles at the slow interval just to keep the badge honest. Deltas via
 * `updatedSince` — full lists are never re-shipped. Swapping this file for a
 * WebSocket layer later touches no components.
 */
const FAST_MS = Number(process.env.NEXT_PUBLIC_REQUESTS_POLL_MS ?? 10_000);
const SLOW_MS = Number(process.env.NEXT_PUBLIC_REQUESTS_BADGE_POLL_MS ?? 45_000);

type NewRequestListener = (rows: TenantRequestView[]) => void;

interface RequestsFeedValue {
  /** Null until the first load lands. Includes recently-finalized rows. */
  requests: TenantRequestView[] | null;
  counts: RequestBoardCounts | null;
  error: ApiError | null;
  refresh: () => Promise<void>;
  /** Optimistically merge a mutated row (lifecycle actions). */
  applyRow: (row: TenantRequestView) => void;
  /** Board mounts register to switch the poller to the fast interval. */
  boost: () => () => void;
  /** Subscribe to genuinely-new incoming requests (badge pulse + chime). */
  onNewRequests: (listener: NewRequestListener) => () => void;
}

const RequestsFeedContext = createContext<RequestsFeedValue | null>(null);

export function RequestsFeedProvider({ children }: { children: ReactNode }) {
  const { isModuleEnabled, hasPermission } = useTenant();
  const active = isModuleEnabled('requests') && hasPermission('requests.read');

  const [requests, setRequests] = useState<TenantRequestView[] | null>(null);
  const [counts, setCounts] = useState<RequestBoardCounts | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const cursor = useRef<string | null>(null);
  const knownIds = useRef<Set<string> | null>(null);
  const listeners = useRef(new Set<NewRequestListener>());
  const [boostCount, setBoostCount] = useState(0);

  const load = useCallback(async (mode: 'full' | 'delta') => {
    const since = mode === 'delta' ? cursor.current : null;
    try {
      const feed = await api<RequestBoardResponse>(
        since
          ? `/tenant/requests?updatedSince=${encodeURIComponent(since)}`
          : '/tenant/requests',
      );
      cursor.current = feed.serverTime;
      setError(null);
      setCounts(feed.counts);
      setRequests((prev) =>
        since && prev ? mergeBoardDelta(prev, feed.data) : feed.data,
      );
      // New-arrival detection: ids we have never seen, still status 'new'.
      // The first load only seeds the set — no chime for the backlog.
      const seen = knownIds.current;
      const fresh =
        seen === null
          ? []
          : feed.data.filter((r) => !seen.has(r.id) && r.status === 'new');
      if (seen === null) knownIds.current = new Set(feed.data.map((r) => r.id));
      else for (const row of feed.data) seen.add(row.id);
      if (fresh.length > 0) {
        for (const listener of Array.from(listeners.current)) listener(fresh);
      }
    } catch (err) {
      if (mode === 'full' && err instanceof ApiError) setError(err);
    }
  }, []);

  useEffect(() => {
    if (!active) return;
    void load(cursor.current ? 'delta' : 'full');
    const interval = boostCount > 0 ? FAST_MS : SLOW_MS;
    const timer = setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      void load('delta');
    }, interval);
    return () => clearInterval(timer);
  }, [active, boostCount, load]);

  const value = useMemo<RequestsFeedValue>(
    () => ({
      requests,
      counts,
      error,
      refresh: () => load('full'),
      applyRow: (row) =>
        setRequests((prev) => mergeBoardDelta(prev ?? [], [row])),
      boost: () => {
        setBoostCount((c) => c + 1);
        void load('delta');
        return () => setBoostCount((c) => Math.max(0, c - 1));
      },
      onNewRequests: (listener) => {
        listeners.current.add(listener);
        return () => listeners.current.delete(listener);
      },
    }),
    [requests, counts, error, load],
  );

  return (
    <RequestsFeedContext.Provider value={value}>
      {children}
    </RequestsFeedContext.Provider>
  );
}

/** Safe outside the provider (module off / no permission): inert value. */
export function useRequestsFeed(): RequestsFeedValue {
  const ctx = useContext(RequestsFeedContext);
  return (
    ctx ?? {
      requests: null,
      counts: null,
      error: null,
      refresh: async () => {},
      applyRow: () => {},
      boost: () => () => {},
      onNewRequests: () => () => {},
    }
  );
}
