import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../../../../../messages/en';
import type { EventsReport } from '@/lib/types';

/**
 * Task F2c, Part 3 — Events report tab: fetch, loading, error, success,
 * period changes, and (Part 5, Story 22.6 AC2) a graceful 403 for a
 * reports.read-only viewer who navigates directly to this URL.
 */

const FIXTURE: EventsReport = {
  period: { preset: 'last7', from: '2026-08-27', to: '2026-09-02', days: 7 },
  currency: 'EGP',
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
  ],
  totals: { revenue: 8000, booked: 40, cancellationRatePct: 5 },
  basis: 'events_starting_in_period',
};

vi.mock('@/components/tenant-provider', () => ({ useTenant: () => ({ hasPermission: () => true }) }));
vi.mock('next/navigation', () => ({ useParams: () => ({ slug: 'sunrise' }) }));

const apiMock = vi.hoisted(() => ({ api: vi.fn(), apiBlob: vi.fn(), saveBlob: vi.fn() }));
vi.mock('@/lib/api', () => ({
  api: apiMock.api,
  apiBlob: apiMock.apiBlob,
  saveBlob: apiMock.saveBlob,
  ApiError: class ApiError extends Error {
    constructor(
      public readonly status: number,
      message: string,
      public readonly details?: unknown,
      public readonly code?: string,
    ) {
      super(message);
    }
  },
}));

import { ApiError } from '@/lib/api';
import AnalyticsEventsPage from './page';

function renderPage() {
  return render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Africa/Cairo">
      <AnalyticsEventsPage />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  window.sessionStorage.clear();
});

describe('AnalyticsEventsPage', () => {
  it('calls the events endpoint with the default period on mount', async () => {
    apiMock.api.mockResolvedValue(FIXTURE);
    renderPage();
    await waitFor(() =>
      expect(apiMock.api).toHaveBeenCalledWith('/tenant/reports/events?preset=last7'),
    );
  });

  it('loading → shows a placeholder, not the report content or an error', async () => {
    let resolvePromise!: (v: unknown) => void;
    apiMock.api.mockReturnValue(new Promise((resolve) => (resolvePromise = resolve)));
    renderPage();
    expect(screen.queryByText('Poolside Party')).toBeNull();
    expect(screen.queryByText(en.common.actions.retry)).toBeNull();
    resolvePromise(FIXTURE);
    await screen.findByText('Poolside Party');
  });

  it('error → ErrorState with retry, and retrying calls load again', async () => {
    apiMock.api.mockRejectedValueOnce(new Error('boom'));
    renderPage();
    expect(await screen.findByText(en.common.actions.retry)).toBeTruthy();
    apiMock.api.mockResolvedValueOnce(FIXTURE);
    fireEvent.click(screen.getByText(en.common.actions.retry));
    expect(await screen.findByText('Poolside Party')).toBeTruthy();
    expect(apiMock.api).toHaveBeenCalledTimes(2);
  });

  it('success → EventsContent renders with the fetched data', async () => {
    apiMock.api.mockResolvedValue(FIXTURE);
    renderPage();
    expect(await screen.findByText('Poolside Party')).toBeTruthy();
  });

  it('changing the period via PeriodSelector triggers a new api() call with the updated query string', async () => {
    apiMock.api.mockResolvedValue(FIXTURE);
    renderPage();
    await waitFor(() =>
      expect(apiMock.api).toHaveBeenCalledWith('/tenant/reports/events?preset=last7'),
    );
    fireEvent.click(screen.getByText(en.reports.period.last30));
    await waitFor(() =>
      expect(apiMock.api).toHaveBeenCalledWith('/tenant/reports/events?preset=last30'),
    );
  });

  it('a REPORTS_REVENUE_FORBIDDEN 403 renders the "no access" EmptyState, NOT the generic ErrorState (Story 22.6 AC2)', async () => {
    apiMock.api.mockRejectedValue(
      new ApiError(403, 'Forbidden', undefined, 'REPORTS_REVENUE_FORBIDDEN'),
    );
    renderPage();
    expect(await screen.findByText(en.analytics.revenue.noAccess.title)).toBeTruthy();
    expect(screen.getByText(en.analytics.revenue.noAccess.hint)).toBeTruthy();
    expect(screen.queryByText(en.common.states.errorTitle)).toBeNull();
    expect(screen.queryByText(en.common.actions.retry)).toBeNull();
  });

  it('a generic (non-403-revenue) error still renders the normal ErrorState, not the "no access" EmptyState', async () => {
    apiMock.api.mockRejectedValue(new ApiError(500, 'Server error', undefined, undefined));
    renderPage();
    expect(await screen.findByText(en.common.actions.retry)).toBeTruthy();
    expect(screen.queryByText(en.analytics.revenue.noAccess.title)).toBeNull();
  });

  it('the primary Export button calls apiBlob against the events export endpoint (Task F3)', async () => {
    apiMock.api.mockResolvedValue(FIXTURE);
    apiMock.apiBlob.mockResolvedValue({ blob: new Blob(['x']), filename: 'sunrise-events.xlsx' });
    renderPage();
    await waitFor(() => expect(apiMock.api).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: en.reports.export }));
    await waitFor(() =>
      expect(apiMock.apiBlob).toHaveBeenCalledWith('/tenant/reports/events/export?preset=last7'),
    );
  });

  it('the secondary "export raw data" button calls apiBlob against the bookings-feed export endpoint (Task F3)', async () => {
    apiMock.api.mockResolvedValue(FIXTURE);
    apiMock.apiBlob.mockResolvedValue({ blob: new Blob(['x']), filename: 'sunrise-bookings-feed.csv' });
    renderPage();
    await waitFor(() => expect(apiMock.api).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: en.reports.exportRawData }));
    await waitFor(() =>
      expect(apiMock.apiBlob).toHaveBeenCalledWith('/tenant/reports/bookings-feed/export?preset=last7'),
    );
  });
});
