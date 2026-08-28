/**
 * Shared live-board core (Epic 15 → generalized in Epic 16): pure SLA /
 * ordering / delta-merge logic over any row that carries status + SLA
 * timing. One board engine, two configurations (requests board, kitchen
 * board) — the per-domain modules bind their own open-status lists.
 */
export interface BoardRow {
  id: string;
  status: string;
  slaTargetMinutes: number;
  dueAt: string;
  createdAt: string;
}

export type SlaState = 'ok' | 'warning' | 'overdue';

/** Amber at ≥80% of the target elapsed, red past dueAt. Final states exit SLA. */
export function slaState(
  row: BoardRow,
  now: Date,
  openStatuses: ReadonlyArray<string>,
): SlaState {
  if (!openStatuses.includes(row.status)) return 'ok';
  const due = new Date(row.dueAt).getTime();
  if (now.getTime() >= due) return 'overdue';
  const start = due - row.slaTargetMinutes * 60_000;
  const elapsedRatio = (now.getTime() - start) / (due - start);
  return elapsedRatio >= 0.8 ? 'warning' : 'ok';
}

/** Overdue floats to the top; newest first within each band. */
export function orderBoard<T extends BoardRow>(
  rows: T[],
  now: Date,
  openStatuses: ReadonlyArray<string>,
): T[] {
  return [...rows].sort((a, b) => {
    const aOverdue = slaState(a, now, openStatuses) === 'overdue' ? 1 : 0;
    const bOverdue = slaState(b, now, openStatuses) === 'overdue' ? 1 : 0;
    if (aOverdue !== bOverdue) return bOverdue - aOverdue;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

/** Replace-by-id merge for `updatedSince` deltas (Epic 15 spec note 4). */
export function mergeBoardDelta<T extends { id: string }>(
  current: T[],
  delta: T[],
): T[] {
  if (delta.length === 0) return current;
  const byId = new Map(current.map((r) => [r.id, r] as [string, T]));
  for (const row of delta) byId.set(row.id, row);
  return Array.from(byId.values());
}

/**
 * Tombstone-aware delta merge (Epic 19 pattern, reused by the Epic 20
 * housekeeping board): a delta row of `{ id, active: false }` means the
 * entity left the board (room turned inactive) and its card must be DROPPED
 * from state, not rendered. Full rows replace-by-id / append as usual.
 */
export function mergeBoardDeltaWithTombstones<T extends { id: string }>(
  current: T[],
  delta: Array<T | { id: string; active: false }>,
): T[] {
  if (delta.length === 0) return current;
  const byId = new Map(current.map((r) => [r.id, r] as [string, T]));
  for (const row of delta) {
    if ('active' in row && row.active === false) byId.delete(row.id);
    else byId.set(row.id, row as T);
  }
  return Array.from(byId.values());
}
