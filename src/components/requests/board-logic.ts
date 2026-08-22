import type { RequestBoardCounts, TenantRequestView } from '@/lib/types';
import {
  mergeBoardDelta as coreMerge,
  orderBoard as coreOrder,
  slaState as coreSla,
  SlaState,
} from '../board/board-core';

/**
 * Pure board logic (15.4 AC1 / 15.6 AC1) — computed client-side so chips
 * turn amber/red and cards float the moment a target passes, between polls
 * (recorded decision; the server only stores dueAt). Epic 16 extracted the
 * generic core to `components/board/board-core.ts`; this module binds it to
 * the requests board's statuses so existing imports stay put.
 */
export type { SlaState };

const OPEN_STATUSES: ReadonlyArray<TenantRequestView['status']> = [
  'new',
  'in_progress',
];

export function isOpen(request: TenantRequestView): boolean {
  return OPEN_STATUSES.includes(request.status);
}

export function slaState(request: TenantRequestView, now: Date): SlaState {
  return coreSla(request, now, OPEN_STATUSES);
}

export function orderBoard(
  requests: TenantRequestView[],
  now: Date,
): TenantRequestView[] {
  return coreOrder(requests, now, OPEN_STATUSES);
}

export const mergeBoardDelta = coreMerge<TenantRequestView>;

export const EMPTY_COUNTS: RequestBoardCounts = {
  open: 0,
  doneToday: 0,
  overdueNow: 0,
};
