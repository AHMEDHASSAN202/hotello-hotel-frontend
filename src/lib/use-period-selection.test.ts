// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { usePeriodSelection } from './use-period-selection';

/**
 * Task F1b, Part 5 — Story 22.1 AC1: the period selection persists per user
 * for the session via sessionStorage, keyed by a caller-supplied storage key.
 */
describe('usePeriodSelection', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it('default {preset:"last7"} when nothing is stored', () => {
    const { result } = renderHook(() => usePeriodSelection('k1'));
    expect(result.current[0]).toEqual({ preset: 'last7' });
  });

  it('initial read from sessionStorage when a value is seeded', () => {
    window.sessionStorage.setItem('k2', JSON.stringify({ preset: 'today' }));
    const { result } = renderHook(() => usePeriodSelection('k2'));
    expect(result.current[0]).toEqual({ preset: 'today' });
  });

  it('calling the setter updates state AND sessionStorage', () => {
    const { result } = renderHook(() => usePeriodSelection('k3'));
    act(() => {
      result.current[1]({ preset: 'custom', from: '2026-01-01', to: '2026-01-05' });
    });
    expect(result.current[0]).toEqual({
      preset: 'custom',
      from: '2026-01-01',
      to: '2026-01-05',
    });
    expect(JSON.parse(window.sessionStorage.getItem('k3')!)).toEqual({
      preset: 'custom',
      from: '2026-01-01',
      to: '2026-01-05',
    });
  });

  it('a corrupted/non-JSON stored value falls back to the default without throwing', () => {
    window.sessionStorage.setItem('k4', '{not json');
    const { result } = renderHook(() => usePeriodSelection('k4'));
    expect(result.current[0]).toEqual({ preset: 'last7' });
  });
});
