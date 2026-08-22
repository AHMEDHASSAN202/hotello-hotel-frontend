import { describe, expect, it } from 'vitest';
import type { TenantRequestView } from '@/lib/types';
import { mergeBoardDelta, orderBoard, slaState } from './board-logic';

function req(overrides: Partial<TenantRequestView>): TenantRequestView {
  return {
    id: 'r1',
    itemNameEn: 'Extra towels',
    itemNameAr: 'مناشف إضافية',
    icon: 'layers',
    categoryId: 'cat-1',
    roomNumber: '204',
    floor: 2,
    guestName: 'Ivan',
    optionType: null,
    optionValue: null,
    note: null,
    noteLanguage: null,
    status: 'new',
    slaTargetMinutes: 20,
    dueAt: '2026-08-22T12:20:00.000Z',
    assignedTo: null,
    createdAt: '2026-08-22T12:00:00.000Z',
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    cancelledReason: null,
    updatedAt: '2026-08-22T12:00:00.000Z',
    ...overrides,
  };
}

describe('slaState (15.6 AC1)', () => {
  const base = req({});

  it('ok while under 80% of the target', () => {
    expect(slaState(base, new Date('2026-08-22T12:10:00Z'))).toBe('ok');
  });

  it('amber from 80% of the target', () => {
    expect(slaState(base, new Date('2026-08-22T12:16:00Z'))).toBe('warning');
  });

  it('red past the target', () => {
    expect(slaState(base, new Date('2026-08-22T12:21:00Z'))).toBe('overdue');
  });

  it('final states exit SLA entirely (15.6 AC2)', () => {
    expect(
      slaState(req({ status: 'done' }), new Date('2026-08-22T13:00:00Z')),
    ).toBe('ok');
    expect(
      slaState(req({ status: 'cancelled' }), new Date('2026-08-22T13:00:00Z')),
    ).toBe('ok');
  });
});

describe('orderBoard (15.4 AC1 — overdue floats)', () => {
  it('overdue first, then newest first', () => {
    const now = new Date('2026-08-22T12:30:00Z');
    const fresh = req({ id: 'fresh', createdAt: '2026-08-22T12:25:00.000Z', dueAt: '2026-08-22T12:45:00.000Z' });
    const older = req({ id: 'older', createdAt: '2026-08-22T12:10:00.000Z', dueAt: '2026-08-22T12:40:00.000Z' });
    const overdue = req({ id: 'late', createdAt: '2026-08-22T11:00:00.000Z', dueAt: '2026-08-22T11:20:00.000Z' });
    expect(orderBoard([older, fresh, overdue], now).map((r) => r.id)).toEqual([
      'late',
      'fresh',
      'older',
    ]);
  });
});

describe('mergeBoardDelta (spec note 4)', () => {
  it('replaces matching ids and appends new ones', () => {
    const current = [req({ id: 'a' })];
    const merged = mergeBoardDelta(current, [
      req({ id: 'a', status: 'done' }),
      req({ id: 'b' }),
    ]);
    expect(merged.find((r) => r.id === 'a')?.status).toBe('done');
    expect(merged).toHaveLength(2);
  });
});
