import { render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';
import en from '../../../messages/en';
import type { EventsReport } from '@/lib/types';
import { EventsContent } from './events-content';

const FIXTURE: EventsReport = {
  period: { preset: 'last7', from: '2026-08-27', to: '2026-09-02', days: 7 },
  currency: 'EGP',
  // Deliberately NOT pre-sorted by revenue — the component itself must sort.
  events: [
    {
      eventId: 'ev-1',
      titles: { en: 'Poolside Party' },
      startAtLocal: '2026-08-28 19:00',
      capacity: 60,
      booked: 40,
      revenue: 8000,
      paidSeats: 35,
      freeSeats: 5,
      includedSeats: 0,
      cancellationRatePct: 5,
    },
    {
      eventId: 'ev-2',
      titles: { en: 'Wine Tasting' },
      startAtLocal: '2026-08-29 20:00',
      capacity: 30,
      booked: 28,
      revenue: 15000,
      paidSeats: 28,
      freeSeats: 0,
      includedSeats: 0,
      cancellationRatePct: 2,
    },
    {
      eventId: 'ev-3',
      titles: { en: 'Kids Movie Night' },
      startAtLocal: '2026-08-30 17:00',
      capacity: 40,
      booked: 20,
      revenue: 1000,
      paidSeats: 10,
      freeSeats: 10,
      includedSeats: 0,
      cancellationRatePct: 10,
    },
  ],
  totals: { revenue: 24000, booked: 88, cancellationRatePct: 5.7 },
  basis: 'events_starting_in_period',
};

function renderContent(report: EventsReport = FIXTURE) {
  return render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Africa/Cairo">
      <EventsContent report={report} />
    </NextIntlClientProvider>,
  );
}

describe('EventsContent (Task F2c, Part 3)', () => {
  it('renders the top-line revenue/booked/cancellationRate stat tiles from totals', () => {
    renderContent();
    const stats = screen.getByTestId('events-stats');
    expect(within(stats).getByText(en.analytics.events.revenue)).toBeTruthy();
    expect(within(stats).getByText('EGP 24,000.00')).toBeTruthy();
    expect(within(stats).getByText(en.analytics.events.booked)).toBeTruthy();
    expect(within(stats).getByText('88')).toBeTruthy();
    expect(within(stats).getByText(en.analytics.events.cancellationRate)).toBeTruthy();
    expect(within(stats).getByText('5.7%')).toBeTruthy();
  });

  it('renders one row per event with Event | Start | Booked | Revenue | Cancellation rate %', () => {
    renderContent();
    expect(screen.getByText('Poolside Party')).toBeTruthy();
    expect(screen.getByText('2026-08-28 19:00')).toBeTruthy();
    expect(screen.getByText('EGP 8,000.00')).toBeTruthy();
    expect(screen.getByText('5%')).toBeTruthy();
  });

  /**
   * DELIBERATE DISTINCTION from Task F2b's housekeeping attendants rule:
   * that table must NEVER be sorted by completion count (workload, not a
   * leaderboard). This events table is the opposite case — Story 22.3 AC2
   * explicitly wants "best-performing events" as a ranking, so sorting by
   * revenue descending IS the correct, intended behavior here. Do not
   * "fix" this into API-order like housekeeping's attendants — that would
   * be applying the wrong rule to the wrong table.
   */
  it('sorts event rows by revenue DESCENDING (ranking IS intended here — unlike housekeeping attendants, which must NOT be ranked)', () => {
    renderContent();
    const rows = screen.getAllByRole('row').slice(1); // skip the header row
    const names = rows.map((row) => within(row).getAllByRole('cell')[0].textContent);
    expect(names).toEqual(['Wine Tasting', 'Poolside Party', 'Kids Movie Night']);
  });

  it('event titles use the English-preferred fallback (same convention as the by-zone table)', () => {
    renderContent({
      ...FIXTURE,
      events: [{ ...FIXTURE.events[0], titles: { ar: 'حفلة المسبح' } }],
    });
    expect(screen.getByText('حفلة المسبح')).toBeTruthy();
  });

  it('renders the events_starting_in_period BasisFootnote', () => {
    renderContent();
    expect(screen.getByText(en.reports.basis.events_starting_in_period)).toBeTruthy();
  });
});
