'use client';
import { useState } from 'react';
import type { ReportPreset } from './types';

export interface PeriodSelection {
  preset: ReportPreset;
  from?: string; // 'YYYY-MM-DD', only meaningful when preset === 'custom'
  to?: string;
}

const DEFAULT: PeriodSelection = { preset: 'last7' };

/**
 * Story 22.1 AC1 — "the selection persists per user for the session."
 * `storageKey` should be unique per hotel+page (e.g.
 * `gxp:${slug}:reports-period` — one shared key across every report tab
 * so switching tabs keeps the same period, matching "my morning check-in"
 * framing) so multiple open tabs/hotels don't collide.
 */
export function usePeriodSelection(storageKey: string): [PeriodSelection, (next: PeriodSelection) => void] {
  const [value, setValue] = useState<PeriodSelection>(() => {
    if (typeof window === 'undefined') return DEFAULT;
    try {
      const raw = window.sessionStorage.getItem(storageKey);
      return raw ? (JSON.parse(raw) as PeriodSelection) : DEFAULT;
    } catch {
      return DEFAULT;
    }
  });

  const setAndPersist = (next: PeriodSelection) => {
    setValue(next);
    try {
      window.sessionStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // sessionStorage unavailable (private mode, quota) — in-memory state still works this session.
    }
  };

  return [value, setAndPersist];
}
