import { render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';
import en from '../../../messages/en';
import type { HousekeepingReport } from '@/lib/types';
import { HousekeepingContent } from './housekeeping-content';
import { mockResponsiveContainerSize } from './charts/test-support';

mockResponsiveContainerSize();

/**
 * Deliberately NOT sorted descending by `completed` — Mona (12) comes
 * before Ahmed (30) comes before Sara (18). If the component ever sorts
 * this into ranking order, the row-order assertion below catches it.
 */
const FIXTURE: HousekeepingReport = {
  period: { preset: 'last7', from: '2026-08-27', to: '2026-09-02', days: 7 },
  cleanedByDay: [
    { date: '2026-08-27', checkout: 5, daily: 12 },
    { date: '2026-08-28', checkout: 6, daily: 14 },
  ],
  avgFlagToCleanMinutes: 22.5,
  attendants: [
    { userId: 'u1', name: 'Mona', completed: 12, perDay: 4 },
    { userId: 'u2', name: 'Ahmed', completed: 30, perDay: 10 },
    { userId: 'u3', name: 'Sara', completed: 18, perDay: 6 },
  ],
  dndClearedCount: 9,
  dndNow: 2,
};

function renderContent(report: HousekeepingReport = FIXTURE) {
  return render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Africa/Cairo">
      <HousekeepingContent report={report} />
    </NextIntlClientProvider>,
  );
}

describe('HousekeepingContent (Task F2b, Part 4)', () => {
  it('renders stat tiles with the fetched values', () => {
    renderContent();
    expect(screen.getByText(en.analytics.housekeeping.dndCleared)).toBeTruthy();
    expect(screen.getByText('9')).toBeTruthy();
    expect(screen.getByText(en.analytics.housekeeping.dndNow)).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
  });

  it('avgFlagToCleanMinutes: a number renders formatted, not em-dash', () => {
    renderContent();
    expect(screen.getByText('22.5m')).toBeTruthy();
  });

  it('avgFlagToCleanMinutes: null renders "—" not "null"/"NaN"', () => {
    renderContent({ ...FIXTURE, avgFlagToCleanMinutes: null });
    expect(screen.getByText('—')).toBeTruthy();
    expect(screen.queryByText('null')).toBeNull();
    expect(screen.queryByText('NaN')).toBeNull();
  });

  it('an InfoTip with the workload-not-a-ranking guidance sits next to the attendants heading', () => {
    renderContent();
    expect(screen.getByText(en.analytics.housekeeping.attendants)).toBeTruthy();
    // The InfoTip trigger renders as a button, as a sibling of the heading text.
    const heading = screen.getByText(en.analytics.housekeeping.attendants);
    const wrapper = heading.parentElement as HTMLElement;
    expect(within(wrapper).getByRole('button')).toBeTruthy();
  });

  it('attendants table renders every attendant with their completed/per-day figures', () => {
    renderContent();
    expect(screen.getByText('Mona')).toBeTruthy();
    expect(screen.getByText('Ahmed')).toBeTruthy();
    expect(screen.getByText('Sara')).toBeTruthy();
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByText('30')).toBeTruthy();
    expect(screen.getByText('18')).toBeTruthy();
  });

  it("the attendants table is NOT sorted descending by completed — row order matches fixture input order (workload distribution, not a leaderboard)", () => {
    renderContent();
    const rows = screen.getAllByRole('row').slice(1); // drop header row
    const namesInOrder = rows.map((row) => within(row).getAllByRole('cell')[0].textContent);
    expect(namesInOrder).toEqual(['Mona', 'Ahmed', 'Sara']);
    // The leaderboard-shaped order (descending by completed) would be this — assert we did NOT produce it.
    expect(namesInOrder).not.toEqual(['Ahmed', 'Sara', 'Mona']);
  });

  it('dataSince present → renders the honest footnote with the formatted date', () => {
    renderContent({ ...FIXTURE, dataSince: '2026-08-15' });
    expect(screen.getByTestId('housekeeping-data-since')).toBeTruthy();
  });

  it('dataSince absent → no footnote element at all', () => {
    renderContent();
    expect(screen.queryByTestId('housekeeping-data-since')).toBeNull();
  });
});
