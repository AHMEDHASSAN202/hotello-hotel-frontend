import type { RequestBoardCounts, TenantRequestView } from '@/lib/types';

/**
 * Pure board logic (15.4 AC1 / 15.6 AC1) — computed client-side so chips
 * turn amber/red and cards float the moment a target passes, between polls
 * (recorded decision; the server only stores dueAt).
 */
export type SlaState = 'ok' | 'warning' | 'overdue';

const OPEN_STATUSES: ReadonlyArray<TenantRequestView['status']> = [
  'new',
  'in_progress',
];

export function isOpen(request: TenantRequestView): boolean {
  return OPEN_STATUSES.includes(request.status);
}

/** Amber at ≥80% of the target elapsed, red past dueAt. Final states exit SLA. */
export function slaState(request: TenantRequestView, now: Date): SlaState {
  if (!isOpen(request)) return 'ok';
  const due = new Date(request.dueAt).getTime();
  if (now.getTime() >= due) return 'overdue';
  const start = due - request.slaTargetMinutes * 60_000;
  const elapsedRatio = (now.getTime() - start) / (due - start);
  return elapsedRatio >= 0.8 ? 'warning' : 'ok';
}

/** Overdue floats to the top; newest first within each band (15.4 AC1). */
export function orderBoard(
  requests: TenantRequestView[],
  now: Date,
): TenantRequestView[] {
  return [...requests].sort((a, b) => {
    const aOverdue = slaState(a, now) === 'overdue' ? 1 : 0;
    const bOverdue = slaState(b, now) === 'overdue' ? 1 : 0;
    if (aOverdue !== bOverdue) return bOverdue - aOverdue;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

/** Replace-by-id merge for `updatedSince` deltas (spec note 4). */
export function mergeBoardDelta(
  current: TenantRequestView[],
  delta: TenantRequestView[],
): TenantRequestView[] {
  if (delta.length === 0) return current;
  const byId = new Map(current.map((r) => [r.id, r]));
  for (const row of delta) byId.set(row.id, row);
  return Array.from(byId.values());
}

export const EMPTY_COUNTS: RequestBoardCounts = {
  open: 0,
  doneToday: 0,
  overdueNow: 0,
};
