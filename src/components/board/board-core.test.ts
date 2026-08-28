import { describe, expect, it } from 'vitest';
import { mergeBoardDeltaWithTombstones } from './board-core';

/**
 * Epic 20 — the tombstone-aware delta merge behind the housekeeping board
 * (recorded decision 8): rooms that turned inactive come back from
 * `updatedSince` as `{ id, active: false }` and must vanish from state.
 */

interface Row {
  id: string;
  roomNumber: string;
}

const row = (id: string, roomNumber = id.toUpperCase()): Row => ({
  id,
  roomNumber,
});

describe('mergeBoardDeltaWithTombstones (Epic 20, decision 8)', () => {
  it('replaces matching ids and appends new ones, preserving order', () => {
    const merged = mergeBoardDeltaWithTombstones(
      [row('a', '101'), row('b', '102')],
      [row('b', '102-renamed'), row('c', '103')],
    );
    expect(merged.map((r) => r.id)).toEqual(['a', 'b', 'c']);
    expect(merged[1].roomNumber).toBe('102-renamed');
  });

  it('drops tombstoned rows from state', () => {
    const merged = mergeBoardDeltaWithTombstones(
      [row('a'), row('b'), row('c')],
      [{ id: 'b', active: false }],
    );
    expect(merged.map((r) => r.id)).toEqual(['a', 'c']);
  });

  it('handles a mixed delta: update + tombstone + brand-new row', () => {
    const merged = mergeBoardDeltaWithTombstones(
      [row('a', '101'), row('b')],
      [row('a', '101-bis'), { id: 'b', active: false }, row('d')],
    );
    expect(merged.map((r) => r.id)).toEqual(['a', 'd']);
    expect(merged[0].roomNumber).toBe('101-bis');
  });

  it('ignores tombstones for rows the client never had', () => {
    const merged = mergeBoardDeltaWithTombstones(
      [row('a')],
      [{ id: 'ghost', active: false }],
    );
    expect(merged.map((r) => r.id)).toEqual(['a']);
  });

  it('returns the same array untouched for an empty delta', () => {
    const current = [row('a')];
    expect(mergeBoardDeltaWithTombstones(current, [])).toBe(current);
  });
});
