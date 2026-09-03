import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';
import en from '../../../messages/en';
import type { GuestsReport } from '@/lib/types';
import { GuestsContent } from './guests-content';
import { mockResponsiveContainerSize } from './charts/test-support';

mockResponsiveContainerSize();

const FIXTURE: GuestsReport = {
  period: { preset: 'last7', from: '2026-08-27', to: '2026-09-02', days: 7 },
  arrivals: { value: 6, deltaPct: 12.5 },
  departures: { value: 4, deltaPct: -5 },
  inHouseNow: 91,
  avgLengthOfStayDays: 3.2,
  occupancyTrend: [
    { date: '2026-08-27', occupied: 35, totalRooms: 50 },
    { date: '2026-08-28', occupied: 38, totalRooms: 50 },
  ],
  stayTypes: { all_inclusive: 14, half_board: 9 },
  languages: { en: 20, ar: 15 },
  roomChanges: 3,
};

function renderContent(report: GuestsReport = FIXTURE) {
  return render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Africa/Cairo">
      <GuestsContent report={report} />
    </NextIntlClientProvider>,
  );
}

describe('GuestsContent (Task F2b, Part 2)', () => {
  it('renders stat tiles with the fetched values', () => {
    renderContent();
    expect(screen.getByText(en.analytics.guests.arrivals)).toBeTruthy();
    expect(screen.getByText('6')).toBeTruthy();
    expect(screen.getByText(en.analytics.guests.departures)).toBeTruthy();
    expect(screen.getByText('4')).toBeTruthy();
    expect(screen.getByText(en.analytics.guests.inHouseNow)).toBeTruthy();
    expect(screen.getByText('91')).toBeTruthy();
    expect(screen.getByText(en.analytics.guests.roomChanges)).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('avgLengthOfStayDays: a number renders formatted, not em-dash', () => {
    renderContent();
    expect(screen.getByText('3.2')).toBeTruthy();
  });

  it('avgLengthOfStayDays: null renders "—" not "null"/"NaN"/empty string', () => {
    renderContent({ ...FIXTURE, avgLengthOfStayDays: null });
    expect(screen.getByText('—')).toBeTruthy();
    expect(screen.queryByText('null')).toBeNull();
    expect(screen.queryByText('NaN')).toBeNull();
  });

  it('stay-type and language breakdowns render their bucket labels', () => {
    renderContent();
    expect(screen.getByText(en.stays.stayTypes.all_inclusive)).toBeTruthy();
    expect(screen.getByText(en.stays.languages.en)).toBeTruthy();
    expect(screen.getByText(en.stays.languages.ar)).toBeTruthy();
  });

  it('renders the occupancy trend chart legend with translated series labels', () => {
    renderContent();
    expect(screen.getByText(en.analytics.guests.occupied)).toBeTruthy();
    expect(screen.getByText(en.analytics.guests.totalRooms)).toBeTruthy();
  });
});
