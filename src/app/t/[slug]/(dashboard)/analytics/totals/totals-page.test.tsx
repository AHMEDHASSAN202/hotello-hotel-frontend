import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../../../../../messages/en';
import type { TotalsReport } from '@/lib/types';

/**
 * Task F2c, Part 4 — Totals report tab: fetch, loading, error, success,
 * period changes, and (Part 5, Story 22.6 AC2) a graceful 403 for a
 * reports.read-only viewer who navigates directly to this URL.
 */

const FIXTURE: TotalsReport = {
  period: { preset: 'last7', from: '2026-08-27', to: '2026-09-02', days: 7 },
  currency: 'EGP',
  byDay: [{ date: '2026-08-27', dining: 4200, events: 2000, total: 6200 }],
  byMethod: { cash: 6000, roomCharge: 8300 },
  grandTotal: 14300,
  collected: 10000,
  outstanding: 4300,
  basis: 'delivered_booked',
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
import AnalyticsTotalsPage from './page';

function renderPage() {
  return render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Africa/Cairo">
      <AnalyticsTotalsPage />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  window.sessionStorage.clear();
});

describe('AnalyticsTotalsPage', () => {
  it('calls the totals endpoint with the default period on mount', async () => {
    apiMock.api.mockResolvedValue(FIXTURE);
    renderPage();
    await waitFor(() =>
      expect(apiMock.api).toHaveBeenCalledWith('/tenant/reports/totals?preset=last7'),
    );
  });

  it('loading → shows a placeholder, not the report content or an error', async () => {
    let resolvePromise!: (v: unknown) => void;
    apiMock.api.mockReturnValue(new Promise((resolve) => (resolvePromise = resolve)));
    renderPage();
    expect(screen.queryByText(en.analytics.totals.grandTotal)).toBeNull();
    expect(screen.queryByText(en.common.actions.retry)).toBeNull();
    resolvePromise(FIXTURE);
    await screen.findByText(en.analytics.totals.grandTotal);
  });

  it('error → ErrorState with retry, and retrying calls load again', async () => {
    apiMock.api.mockRejectedValueOnce(new Error('boom'));
    renderPage();
    expect(await screen.findByText(en.common.actions.retry)).toBeTruthy();
    apiMock.api.mockResolvedValueOnce(FIXTURE);
    fireEvent.click(screen.getByText(en.common.actions.retry));
    expect(await screen.findByText(en.analytics.totals.grandTotal)).toBeTruthy();
    expect(apiMock.api).toHaveBeenCalledTimes(2);
  });

  it('success → TotalsContent renders with the fetched data', async () => {
    apiMock.api.mockResolvedValue(FIXTURE);
    renderPage();
    expect(await screen.findByText(en.analytics.totals.grandTotal)).toBeTruthy();
    expect(screen.getByText('EGP 14,300.00')).toBeTruthy();
  });

  it('changing the period via PeriodSelector triggers a new api() call with the updated query string', async () => {
    apiMock.api.mockResolvedValue(FIXTURE);
    renderPage();
    await waitFor(() =>
      expect(apiMock.api).toHaveBeenCalledWith('/tenant/reports/totals?preset=last7'),
    );
    fireEvent.click(screen.getByText(en.reports.period.last30));
    await waitFor(() =>
      expect(apiMock.api).toHaveBeenCalledWith('/tenant/reports/totals?preset=last30'),
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

  it('the Export button calls apiBlob against the totals export endpoint (Task F3)', async () => {
    apiMock.api.mockResolvedValue(FIXTURE);
    apiMock.apiBlob.mockResolvedValue({ blob: new Blob(['x']), filename: 'sunrise-totals.xlsx' });
    renderPage();
    await waitFor(() => expect(apiMock.api).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: en.reports.export }));
    await waitFor(() =>
      expect(apiMock.apiBlob).toHaveBeenCalledWith('/tenant/reports/totals/export?preset=last7'),
    );
  });
});
