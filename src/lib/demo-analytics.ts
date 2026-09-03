import type { OverviewReport } from './types';

/**
 * Sample data for the analytics upsell preview (22.6 AC1) — realistic
 * numbers, never seeded into any backend. Same precedent as
 * `src/components/branding/guest-tokens.ts`'s `DEMO_BRANDING`: a static,
 * hand-picked fixture, not a random generator.
 *
 * `revenue` is always present here — the sample always shows the full
 * pitch. Whether a given viewer actually SEES the revenue section is a
 * render-time decision (`OverviewContent`'s `canReadRevenue` prop), never a
 * reason to omit the field from the fixture itself.
 */
export const DEMO_ANALYTICS: OverviewReport = {
  period: { preset: 'last7', from: '2026-08-27', to: '2026-09-02', days: 7 },
  currency: 'EGP',
  occupancy: {
    occupiedNow: 38,
    totalRooms: 50,
    pct: 76,
    arrivalsToday: 6,
    departuresToday: 4,
    inHouseGuests: 91,
    stayTypeBreakdown: { all_inclusive: 14, half_board: 9, bed_breakfast: 8, room_only: 7 },
  },
  service: {
    received: { value: 142, deltaPct: 12.5, previous: 126 },
    completed: { value: 131, deltaPct: 8.3, previous: 121 },
    openNow: 6,
    avgCompletionMinutes: { value: 24.5, deltaPct: -9.2, previous: 27 },
    slaBreachRatePct: { value: 4.2, deltaPct: -1.5, previous: 5.7 },
    topItems: [
      { itemId: 'towels', names: { en: 'Extra towels' }, count: 28 },
      { itemId: 'housekeeping-clean', names: { en: 'Room cleaning' }, count: 22 },
      { itemId: 'wake-up', names: { en: 'Wake-up call' }, count: 17 },
      { itemId: 'maintenance', names: { en: 'Maintenance' }, count: 11 },
      { itemId: 'transport', names: { en: 'Airport transfer' }, count: 9 },
    ],
  },
  housekeeping: { cleanedToday: 21, needingCleaning: 5, inProgress: 3, dnd: 2 },
  revenue: {
    dining: { value: 18420, deltaPct: 6.1, previous: 17360 },
    events: { value: 4200, deltaPct: 21.7, previous: 3450 },
    total: { value: 22620, deltaPct: 8.9, previous: 20775 },
    cash: 9840,
    roomCharge: 12780,
    unsettledTotal: 3120,
    basis: 'delivered_booked',
  },
};
