// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Task F1b, Part 8 — seeds a page's local filter state from a drill-through
 * link's query string, read ONCE on first render. Mocking `next/navigation`
 * follows the same pattern as
 * `src/app/t/[slug]/(dashboard)/announcements/compose/compose-page.test.tsx`.
 */
const nav = vi.hoisted(() => ({
  params: new URLSearchParams(),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => ({ get: (key: string) => nav.params.get(key) }),
}));

// Imported after the mock so the hook picks up the mocked module.
import { useSeededFilters } from './use-seeded-filters';

describe('useSeededFilters', () => {
  beforeEach(() => {
    nav.params = new URLSearchParams();
  });

  it('only the present keys appear in the returned object', () => {
    nav.params.set('categoryId', 'cat-1');
    const { result } = renderHook(() => useSeededFilters(['categoryId', 'from', 'to'] as const));
    expect(result.current).toEqual({ categoryId: 'cat-1' });
  });

  it('a second render with different mocked search params does not change the already-returned value', () => {
    nav.params.set('categoryId', 'cat-1');
    const { result, rerender } = renderHook(() => useSeededFilters(['categoryId'] as const));
    expect(result.current).toEqual({ categoryId: 'cat-1' });

    nav.params.set('categoryId', 'cat-2');
    rerender();
    expect(result.current).toEqual({ categoryId: 'cat-1' });
  });

  it('no requested keys present → empty object', () => {
    const { result } = renderHook(() => useSeededFilters(['categoryId', 'from'] as const));
    expect(result.current).toEqual({});
  });
});
