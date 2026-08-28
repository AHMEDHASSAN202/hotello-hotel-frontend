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
  HousekeepingBoardCounts,
  HousekeepingBoardResponse,
  HousekeepingRoomView,
  HousekeepingStatus,
} from '@/lib/types';
import { mergeBoardDeltaWithTombstones } from '../board/board-core';
import { useTenant } from '../tenant-provider';

/**
 * Epic 20 — the housekeeping twin of RequestsFeedProvider: ONE poller for
 * the nav badge + board, deltas via `updatedSince` (cursor = serverTime),
 * board mounts boost to the fast interval, badge idles slow. Tombstone rows
 * (`{ id, active: false }` — a room turned inactive) are dropped from state.
 * Mounted app-wide next to the other feeds; inert unless the housekeeping
 * module + housekeeping.read are present.
 */
const FAST_MS = Number(
  process.env.NEXT_PUBLIC_HOUSEKEEPING_POLL_MS ??
    process.env.NEXT_PUBLIC_REQUESTS_POLL_MS ??
    10_000,
);
const SLOW_MS = Number(
  process.env.NEXT_PUBLIC_HOUSEKEEPING_BADGE_POLL_MS ??
    process.env.NEXT_PUBLIC_REQUESTS_BADGE_POLL_MS ??
    45_000,
);

type NewlyFlaggedListener = (rooms: HousekeepingRoomView[]) => void;

interface HousekeepingFeedValue {
  /** Null until the first load lands. All board rooms, clean ones included. */
  rooms: HousekeepingRoomView[] | null;
  counts: HousekeepingBoardCounts | null;
  error: ApiError | null;
  refresh: () => Promise<void>;
  /** Optimistically merge a mutated row (lifecycle/assign actions). */
  applyRow: (row: HousekeepingRoomView) => void;
  /** Board mounts register to switch the poller to the fast interval. */
  boost: () => () => void;
  /** Subscribe to rooms that just turned `needs_cleaning` (badge + chime). */
  onNewlyFlagged: (listener: NewlyFlaggedListener) => () => void;
}

const HousekeepingFeedContext = createContext<HousekeepingFeedValue | null>(
  null,
);

export function HousekeepingFeedProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { isModuleEnabled, hasPermission } = useTenant();
  const active =
    isModuleEnabled('housekeeping') && hasPermission('housekeeping.read');

  const [rooms, setRooms] = useState<HousekeepingRoomView[] | null>(null);
  const [counts, setCounts] = useState<HousekeepingBoardCounts | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const cursor = useRef<string | null>(null);
  /** Last known cleanliness per room — the first load only seeds it, so the
   * standing backlog never chimes; afterwards each poll fires once per batch
   * of rooms that newly became `needs_cleaning`. */
  const knownStatus = useRef<Map<string, HousekeepingStatus> | null>(null);
  const listeners = useRef(new Set<NewlyFlaggedListener>());
  const [boostCount, setBoostCount] = useState(0);

  const load = useCallback(async (mode: 'full' | 'delta') => {
    const since = mode === 'delta' ? cursor.current : null;
    try {
      const feed = await api<HousekeepingBoardResponse>(
        since
          ? `/tenant/housekeeping/board?updatedSince=${encodeURIComponent(since)}`
          : '/tenant/housekeeping/board',
      );
      cursor.current = feed.serverTime;
      setError(null);
      setCounts(feed.counts);
      const fullRows = feed.data.filter(
        (r): r is HousekeepingRoomView => !('active' in r && r.active === false),
      );
      setRooms((prev) =>
        since && prev
          ? mergeBoardDeltaWithTombstones(prev, feed.data)
          : fullRows,
      );
      // Newly-flagged detection against the last known state.
      const seen = knownStatus.current;
      const fresh =
        seen === null
          ? []
          : fullRows.filter(
              (r) =>
                r.housekeepingStatus === 'needs_cleaning' &&
                seen.get(r.id) !== 'needs_cleaning',
            );
      if (seen === null) {
        knownStatus.current = new Map(
          fullRows.map((r) => [r.id, r.housekeepingStatus]),
        );
      } else {
        for (const row of feed.data) {
          if ('active' in row && row.active === false) seen.delete(row.id);
          else {
            const view = row as HousekeepingRoomView;
            seen.set(view.id, view.housekeepingStatus);
          }
        }
      }
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

  // Stable callbacks — consumers hang effects off these.
  const refresh = useCallback(() => load('full'), [load]);
  const applyRow = useCallback((row: HousekeepingRoomView) => {
    // Track the status too, so a flag the user set locally never chimes back.
    knownStatus.current?.set(row.id, row.housekeepingStatus);
    setRooms((prev) => mergeBoardDeltaWithTombstones(prev ?? [], [row]));
  }, []);
  const boost = useCallback(() => {
    setBoostCount((c) => c + 1);
    void load('delta');
    return () => setBoostCount((c) => Math.max(0, c - 1));
  }, [load]);
  const onNewlyFlagged = useCallback((listener: NewlyFlaggedListener) => {
    listeners.current.add(listener);
    return () => {
      listeners.current.delete(listener);
    };
  }, []);

  const value = useMemo<HousekeepingFeedValue>(
    () => ({
      rooms,
      counts,
      error,
      refresh,
      applyRow,
      boost,
      onNewlyFlagged,
    }),
    [rooms, counts, error, refresh, applyRow, boost, onNewlyFlagged],
  );

  return (
    <HousekeepingFeedContext.Provider value={value}>
      {children}
    </HousekeepingFeedContext.Provider>
  );
}

/** Safe outside the provider (module off / no permission): inert value. */
export function useHousekeepingFeed(): HousekeepingFeedValue {
  const ctx = useContext(HousekeepingFeedContext);
  return (
    ctx ?? {
      rooms: null,
      counts: null,
      error: null,
      refresh: async () => {},
      applyRow: () => {},
      boost: () => () => {},
      onNewlyFlagged: () => () => {},
    }
  );
}
