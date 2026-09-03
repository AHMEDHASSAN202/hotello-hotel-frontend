import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../../../../../messages/en';
import type { DiningReport } from '@/lib/types';

/**
 * Task F2c, Part 2 — Dining report tab: fetch, loading, error, success,
 * period changes, and (Part 5, Story 22.6 AC2) a graceful 403 for a
 * reports.read-only viewer who navigates directly to this URL.
 */

const FIXTURE: DiningReport = {
  period: { preset: 'last7', from: '2026-08-27', to: '2026-09-02', days: 7 },
  currency: 'EGP',
  revenueByDay: [
    { date: '2026-08-27', revenue: 4200, orders: 18 },
    { date: '2026-08-28', revenue: 5100, orders: 22 },
  ],
  ordersCount: 40,
  revenueTotal: 9300,
  avgOrderValue: 232.5,
  topItems: [{ itemId: 'item-1', names: { en: 'Grilled Chicken' }, qty: 15, revenue: 3000 }],
  includedConsumption: [{ itemId: 'item-3', names: { en: 'Breakfast Mojito' }, qty: 8 }],
  byZone: [
    { destinationType: 'room', locationKey: null, names: null, revenue: 6000, orders: 25 },
  ],
  paymentSplit: { cash: 4000, roomCharge: 5300 },
  cancellations: { count: 3, reasons: [{ reason: 'duplicate', count: 2 }] },
  basis: 'delivered_only',
};

vi.mock('@/components/tenant-provider', () => ({ useTenant: () => ({ hasPermission: () => true }) }));
vi.mock('next/navigation', () => ({ useParams: () => ({ slug: 'sunrise' }) }));

const apiMock = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock('@/lib/api', () => ({
  api: apiMock.api,
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
import AnalyticsDiningPage from './page';

function renderPage() {
  return render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Africa/Cairo">
      <AnalyticsDiningPage />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  window.sessionStorage.clear();
});

describe('AnalyticsDiningPage', () => {
  it('calls the dining endpoint with the default period on mount', async () => {
    apiMock.api.mockResolvedValue(FIXTURE);
    renderPage();
    await waitFor(() =>
      expect(apiMock.api).toHaveBeenCalledWith('/tenant/reports/dining?preset=last7'),
    );
  });

  it('loading → shows a placeholder, not the report content or an error', async () => {
    let resolvePromise!: (v: unknown) => void;
    apiMock.api.mockReturnValue(new Promise((resolve) => (resolvePromise = resolve)));
    renderPage();
    expect(screen.queryByText(en.analytics.dining.topItems)).toBeNull();
    expect(screen.queryByText(en.common.actions.retry)).toBeNull();
    resolvePromise(FIXTURE);
    await screen.findByText(en.analytics.dining.topItems);
  });

  it('error → ErrorState with retry, and retrying calls load again', async () => {
    apiMock.api.mockRejectedValueOnce(new Error('boom'));
    renderPage();
    expect(await screen.findByText(en.common.actions.retry)).toBeTruthy();
    apiMock.api.mockResolvedValueOnce(FIXTURE);
    fireEvent.click(screen.getByText(en.common.actions.retry));
    expect(await screen.findByText(en.analytics.dining.topItems)).toBeTruthy();
    expect(apiMock.api).toHaveBeenCalledTimes(2);
  });

  it('success → DiningContent renders with the fetched data', async () => {
    apiMock.api.mockResolvedValue(FIXTURE);
    renderPage();
    expect(await screen.findByText(en.analytics.dining.topItems)).toBeTruthy();
    expect(screen.getByText('Grilled Chicken')).toBeTruthy();
  });

  it('changing the period via PeriodSelector triggers a new api() call with the updated query string', async () => {
    apiMock.api.mockResolvedValue(FIXTURE);
    renderPage();
    await waitFor(() =>
      expect(apiMock.api).toHaveBeenCalledWith('/tenant/reports/dining?preset=last7'),
    );
    fireEvent.click(screen.getByText(en.reports.period.last30));
    await waitFor(() =>
      expect(apiMock.api).toHaveBeenCalledWith('/tenant/reports/dining?preset=last30'),
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
});
