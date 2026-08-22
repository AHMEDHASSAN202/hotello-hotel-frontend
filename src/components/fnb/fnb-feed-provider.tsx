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
  FnbBoardCounts,
  FnbBoardResponse,
  TenantFnbOrder,
} from '@/lib/types';
import { mergeBoardDelta } from '../board/board-core';
import { useTenant } from '../tenant-provider';

/**
 * Epic 16 — the kitchen-board twin of RequestsFeedProvider: ONE poller for
 * badge + board, deltas via `updatedSince`, board mounts boost to the fast
 * interval, badge idles slow. Mounted app-wide next to the requests feed;
 * inert unless the fnb module + fnb_orders.read are present.
 */
const FAST_MS = Number(
  process.env.NEXT_PUBLIC_FNB_POLL_MS ??
    process.env.NEXT_PUBLIC_REQUESTS_POLL_MS ??
    10_000,
);
const SLOW_MS = Number(
  process.env.NEXT_PUBLIC_FNB_BADGE_POLL_MS ??
    process.env.NEXT_PUBLIC_REQUESTS_BADGE_POLL_MS ??
    45_000,
);

type NewOrderListener = (rows: TenantFnbOrder[]) => void;

interface FnbFeedValue {
  orders: TenantFnbOrder[] | null;
  counts: FnbBoardCounts | null;
  error: ApiError | null;
  refresh: () => Promise<void>;
  applyRow: (row: TenantFnbOrder) => void;
  boost: () => () => void;
  onNewOrders: (listener: NewOrderListener) => () => void;
}

const FnbFeedContext = createContext<FnbFeedValue | null>(null);

export function FnbFeedProvider({ children }: { children: ReactNode }) {
  const { isModuleEnabled, hasPermission } = useTenant();
  const active = isModuleEnabled('fnb') && hasPermission('fnb_orders.read');

  const [orders, setOrders] = useState<TenantFnbOrder[] | null>(null);
  const [counts, setCounts] = useState<FnbBoardCounts | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const cursor = useRef<string | null>(null);
  const knownIds = useRef<Set<string> | null>(null);
  const listeners = useRef(new Set<NewOrderListener>());
  const [boostCount, setBoostCount] = useState(0);

  const load = useCallback(async (mode: 'full' | 'delta') => {
    const since = mode === 'delta' ? cursor.current : null;
    try {
      const feed = await api<FnbBoardResponse>(
        since
          ? `/tenant/fnb-orders?updatedSince=${encodeURIComponent(since)}`
          : '/tenant/fnb-orders',
      );
      cursor.current = feed.serverTime;
      setError(null);
      setCounts(feed.counts);
      setOrders((prev) =>
        since && prev ? mergeBoardDelta(prev, feed.data) : feed.data,
      );
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

  const refresh = useCallback(() => load('full'), [load]);
  const applyRow = useCallback((row: TenantFnbOrder) => {
    setOrders((prev) => mergeBoardDelta(prev ?? [], [row]));
  }, []);
  const boost = useCallback(() => {
    setBoostCount((c) => c + 1);
    void load('delta');
    return () => setBoostCount((c) => Math.max(0, c - 1));
  }, [load]);
  const onNewOrders = useCallback((listener: NewOrderListener) => {
    listeners.current.add(listener);
    return () => {
      listeners.current.delete(listener);
    };
  }, []);

  const value = useMemo<FnbFeedValue>(
    () => ({ orders, counts, error, refresh, applyRow, boost, onNewOrders }),
    [orders, counts, error, refresh, applyRow, boost, onNewOrders],
  );

  return (
    <FnbFeedContext.Provider value={value}>{children}</FnbFeedContext.Provider>
  );
}

/** Safe outside the provider (module off / no permission): inert value. */
export function useFnbFeed(): FnbFeedValue {
  const ctx = useContext(FnbFeedContext);
  return (
    ctx ?? {
      orders: null,
      counts: null,
      error: null,
      refresh: async () => {},
      applyRow: () => {},
      boost: () => () => {},
      onNewOrders: () => () => {},
    }
  );
}
