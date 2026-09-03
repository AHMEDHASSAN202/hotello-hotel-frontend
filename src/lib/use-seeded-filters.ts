'use client';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

/**
 * Reads the given keys from the URL's query string ONCE, on first render —
 * for seeding a page's local filter state from a drill-through link. Later
 * URL changes (e.g. the user editing filters in-page) are NOT tracked by
 * this hook; the consuming page owns its own state after the initial seed.
 */
export function useSeededFilters<K extends string>(keys: readonly K[]): Partial<Record<K, string>> {
  const searchParams = useSearchParams();
  const [seeded] = useState<Partial<Record<K, string>>>(() => {
    const result: Partial<Record<K, string>> = {};
    for (const key of keys) {
      const value = searchParams.get(key);
      if (value !== null) result[key] = value;
    }
    return result;
  });
  return seeded;
}
