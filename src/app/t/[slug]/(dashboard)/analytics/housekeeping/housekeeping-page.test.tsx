import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../../../../../messages/en';
import type { HousekeepingReport } from '@/lib/types';

/** Task F2b, Part 4 — Housekeeping report tab: fetch, loading, error, success, period changes. */

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

import AnalyticsHousekeepingPage from './page';

function renderPage() {
  return render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Africa/Cairo">
      <AnalyticsHousekeepingPage />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  window.sessionStorage.clear();
});

describe('AnalyticsHousekeepingPage', () => {
  it('calls the housekeeping endpoint with the default period on mount', async () => {
    apiMock.api.mockResolvedValue(FIXTURE);
    renderPage();
    await waitFor(() =>
      expect(apiMock.api).toHaveBeenCalledWith('/tenant/reports/housekeeping?preset=last7'),
    );
  });

  it('loading → shows a placeholder, not the report content or an error', async () => {
    let resolvePromise!: (v: unknown) => void;
    apiMock.api.mockReturnValue(new Promise((resolve) => (resolvePromise = resolve)));
    renderPage();
    expect(screen.queryByText(en.analytics.housekeeping.attendants)).toBeNull();
    expect(screen.queryByText(en.common.actions.retry)).toBeNull();
    resolvePromise(FIXTURE);
    await screen.findByText(en.analytics.housekeeping.attendants);
  });

  it('error → ErrorState with retry, and retrying calls load again', async () => {
    apiMock.api.mockRejectedValueOnce(new Error('boom'));
    renderPage();
    expect(await screen.findByText(en.common.actions.retry)).toBeTruthy();
    apiMock.api.mockResolvedValueOnce(FIXTURE);
    fireEvent.click(screen.getByText(en.common.actions.retry));
    expect(await screen.findByText(en.analytics.housekeeping.attendants)).toBeTruthy();
    expect(apiMock.api).toHaveBeenCalledTimes(2);
  });

  it('success → HousekeepingContent renders with the fetched data', async () => {
    apiMock.api.mockResolvedValue(FIXTURE);
    renderPage();
    expect(await screen.findByText(en.analytics.housekeeping.attendants)).toBeTruthy();
    expect(screen.getByText('Mona')).toBeTruthy();
  });

  it('changing the period via PeriodSelector triggers a new api() call with the updated query string', async () => {
    apiMock.api.mockResolvedValue(FIXTURE);
    renderPage();
    await waitFor(() =>
      expect(apiMock.api).toHaveBeenCalledWith('/tenant/reports/housekeeping?preset=last7'),
    );
    fireEvent.click(screen.getByText(en.reports.period.last30));
    await waitFor(() =>
      expect(apiMock.api).toHaveBeenCalledWith('/tenant/reports/housekeeping?preset=last30'),
    );
  });

  it('the Export button calls apiBlob against the housekeeping export endpoint (Task F3)', async () => {
    apiMock.api.mockResolvedValue(FIXTURE);
    apiMock.apiBlob.mockResolvedValue({ blob: new Blob(['x']), filename: 'sunrise-housekeeping.xlsx' });
    renderPage();
    await waitFor(() => expect(apiMock.api).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: en.reports.export }));
    await waitFor(() =>
      expect(apiMock.apiBlob).toHaveBeenCalledWith('/tenant/reports/housekeeping/export?preset=last7'),
    );
  });
});
