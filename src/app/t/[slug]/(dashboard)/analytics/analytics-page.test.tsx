import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../../../../messages/en';
import { DEMO_ANALYTICS } from '@/lib/demo-analytics';

/** Task F2a, Part 4 — the real (unlocked) Overview page: fetch, loading, error, success, period changes. */

const tenant = vi.hoisted(() => ({
  hasPermission: vi.fn(() => true),
}));
vi.mock('@/components/tenant-provider', () => ({ useTenant: () => tenant }));
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

import AnalyticsOverviewPage from './page';

function renderPage() {
  return render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Africa/Cairo">
      <AnalyticsOverviewPage />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  tenant.hasPermission.mockReturnValue(true);
  window.sessionStorage.clear();
});

describe('AnalyticsOverviewPage (unlocked)', () => {
  it('calls the overview endpoint with the default period on mount', async () => {
    apiMock.api.mockResolvedValue(DEMO_ANALYTICS);
    renderPage();
    await waitFor(() =>
      expect(apiMock.api).toHaveBeenCalledWith('/tenant/reports/overview?preset=last7'),
    );
  });

  it('loading → shows a placeholder, not the report content or an error', async () => {
    let resolvePromise!: (v: unknown) => void;
    apiMock.api.mockReturnValue(new Promise((resolve) => (resolvePromise = resolve)));
    renderPage();
    expect(screen.queryByText(en.analytics.overview.occupancy.heading)).toBeNull();
    expect(screen.queryByText(en.common.actions.retry)).toBeNull();
    resolvePromise(DEMO_ANALYTICS);
    await screen.findByText(en.analytics.overview.occupancy.heading);
  });

  it('error → ErrorState with retry, and retrying calls load again', async () => {
    apiMock.api.mockRejectedValueOnce(new Error('boom'));
    renderPage();
    expect(await screen.findByText(en.common.actions.retry)).toBeTruthy();
    apiMock.api.mockResolvedValueOnce(DEMO_ANALYTICS);
    fireEvent.click(screen.getByText(en.common.actions.retry));
    expect(
      await screen.findByText(en.analytics.overview.occupancy.heading),
    ).toBeTruthy();
    expect(apiMock.api).toHaveBeenCalledTimes(2);
  });

  it('success → OverviewContent renders with the fetched data', async () => {
    apiMock.api.mockResolvedValue(DEMO_ANALYTICS);
    renderPage();
    expect(
      await screen.findByText(en.analytics.overview.occupancy.heading),
    ).toBeTruthy();
    expect(
      screen.getByText(
        `${DEMO_ANALYTICS.occupancy.occupiedNow}/${DEMO_ANALYTICS.occupancy.totalRooms}`,
      ),
    ).toBeTruthy();
  });

  it('changing the period via PeriodSelector triggers a new api() call with the updated query string', async () => {
    apiMock.api.mockResolvedValue(DEMO_ANALYTICS);
    renderPage();
    await waitFor(() =>
      expect(apiMock.api).toHaveBeenCalledWith('/tenant/reports/overview?preset=last7'),
    );
    fireEvent.click(screen.getByText(en.reports.period.last30));
    await waitFor(() =>
      expect(apiMock.api).toHaveBeenCalledWith('/tenant/reports/overview?preset=last30'),
    );
  });
});
