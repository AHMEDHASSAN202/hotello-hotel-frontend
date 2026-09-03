import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../../../../../messages/en';
import type { RequestsReport } from '@/lib/types';

/** Task F2b, Part 3 — Services (requests report) tab: fetch, loading, error, success, period changes. */

const FIXTURE: RequestsReport = {
  period: { preset: 'last7', from: '2026-08-27', to: '2026-09-02', days: 7 },
  receivedCount: 142,
  completedCount: 131,
  overallDoneWithSlaCount: 120,
  overallSlaBreachRatePct: 4.2,
  overallAvgCompletionMinutes: 24.5,
  volumeByDay: [
    { date: '2026-08-27', count: 20 },
    { date: '2026-08-28', count: 25 },
  ],
  byCategory: [
    { categoryId: 'cat-1', names: { en: 'Housekeeping' }, count: 40, slaCompliancePct: 96, avgCompletionMinutes: 18 },
  ],
  byItem: [{ itemId: 'item-1', names: { en: 'Extra towels' }, count: 28 }],
  completionBuckets: [
    { label: '<15m', count: 40 },
    { label: '15-30m', count: 30 },
  ],
  cancellations: { count: 5, reasons: [{ reason: 'guest_changed_mind', count: 3 }] },
  busiestHours: Array.from({ length: 24 }, (_, h) => (h === 12 ? 10 : 1)),
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

import AnalyticsServicesPage from './page';

function renderPage() {
  return render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Africa/Cairo">
      <AnalyticsServicesPage />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  window.sessionStorage.clear();
});

describe('AnalyticsServicesPage', () => {
  it('calls the requests endpoint with the default period on mount', async () => {
    apiMock.api.mockResolvedValue(FIXTURE);
    renderPage();
    await waitFor(() =>
      expect(apiMock.api).toHaveBeenCalledWith('/tenant/reports/requests?preset=last7'),
    );
  });

  it('loading → shows a placeholder, not the report content or an error', async () => {
    let resolvePromise!: (v: unknown) => void;
    apiMock.api.mockReturnValue(new Promise((resolve) => (resolvePromise = resolve)));
    renderPage();
    expect(screen.queryByText(en.analytics.services.received)).toBeNull();
    expect(screen.queryByText(en.common.actions.retry)).toBeNull();
    resolvePromise(FIXTURE);
    await screen.findByText(en.analytics.services.received);
  });

  it('error → ErrorState with retry, and retrying calls load again', async () => {
    apiMock.api.mockRejectedValueOnce(new Error('boom'));
    renderPage();
    expect(await screen.findByText(en.common.actions.retry)).toBeTruthy();
    apiMock.api.mockResolvedValueOnce(FIXTURE);
    fireEvent.click(screen.getByText(en.common.actions.retry));
    expect(await screen.findByText(en.analytics.services.received)).toBeTruthy();
    expect(apiMock.api).toHaveBeenCalledTimes(2);
  });

  it('success → ServicesContent renders with the fetched data', async () => {
    apiMock.api.mockResolvedValue(FIXTURE);
    renderPage();
    expect(await screen.findByText(en.analytics.services.received)).toBeTruthy();
    expect(screen.getByText('142')).toBeTruthy();
  });

  it('changing the period via PeriodSelector triggers a new api() call with the updated query string', async () => {
    apiMock.api.mockResolvedValue(FIXTURE);
    renderPage();
    await waitFor(() =>
      expect(apiMock.api).toHaveBeenCalledWith('/tenant/reports/requests?preset=last7'),
    );
    fireEvent.click(screen.getByText(en.reports.period.last30));
    await waitFor(() =>
      expect(apiMock.api).toHaveBeenCalledWith('/tenant/reports/requests?preset=last30'),
    );
  });

  it('the primary Export button calls apiBlob against the requests export endpoint (Task F3)', async () => {
    apiMock.api.mockResolvedValue(FIXTURE);
    apiMock.apiBlob.mockResolvedValue({ blob: new Blob(['x']), filename: 'sunrise-requests.xlsx' });
    renderPage();
    await waitFor(() => expect(apiMock.api).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: en.reports.export }));
    await waitFor(() =>
      expect(apiMock.apiBlob).toHaveBeenCalledWith('/tenant/reports/requests/export?preset=last7'),
    );
  });

  it('the secondary "export raw data" button calls apiBlob against the requests-feed export endpoint (Task F3)', async () => {
    apiMock.api.mockResolvedValue(FIXTURE);
    apiMock.apiBlob.mockResolvedValue({ blob: new Blob(['x']), filename: 'sunrise-requests-feed.csv' });
    renderPage();
    await waitFor(() => expect(apiMock.api).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: en.reports.exportRawData }));
    await waitFor(() =>
      expect(apiMock.apiBlob).toHaveBeenCalledWith('/tenant/reports/requests-feed/export?preset=last7'),
    );
  });
});
