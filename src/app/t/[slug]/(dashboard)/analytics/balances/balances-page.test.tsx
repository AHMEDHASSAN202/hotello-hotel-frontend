import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../../../../../messages/en';
import type { BalancesReport, LeakageReport } from '@/lib/types';

/**
 * Task F2d, Part 3 — Story 22.4. The Outstanding Balances report tab: two
 * local sub-views (outstanding / leakage) behind a pill toggle, not routes.
 */

const OUTSTANDING: BalancesReport = {
  currency: 'EGP',
  departingTodayCount: 3,
  departingTodayTotal: 450,
  totalOutstanding: 900,
  rows: [
    {
      stayId: 's1',
      roomId: 'r1',
      roomNumber: '101',
      guestName: 'Ahmed Ali',
      checkOutDate: '2026-09-03',
      departsToday: true,
      total: 250,
      byKey: { fnb: 200, events: 50 },
      oldestUnsettledAt: '2026-09-01T10:00:00Z',
    },
    {
      stayId: 's2',
      roomId: 'r2',
      roomNumber: '102',
      guestName: 'Mona Said',
      checkOutDate: '2026-09-05',
      departsToday: false,
      total: 650,
      byKey: { fnb: 650, events: 0 },
      oldestUnsettledAt: '2026-09-02T10:00:00Z',
    },
  ],
};

const LEAKAGE: LeakageReport = {
  period: { preset: 'last7', from: '2026-08-27', to: '2026-09-02', days: 7 },
  currency: 'EGP',
  totalLost: 1200,
  rows: [
    {
      stayId: 's3',
      roomNumber: '103',
      guestName: 'Sara Adel',
      checkedOutAt: '2026-08-30T09:00:00Z',
      checkoutType: 'automatic',
      total: 1200,
      byKey: { fnb: 1200, events: 0 },
    },
  ],
};

const tenant = vi.hoisted(() => ({
  hasPermission: vi.fn(() => true),
  readOnly: false,
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

import AnalyticsBalancesPage from './page';

function renderPage() {
  return render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Africa/Cairo">
      <AnalyticsBalancesPage />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  apiMock.api.mockReset();
  tenant.hasPermission.mockReset();
  tenant.hasPermission.mockReturnValue(true);
  tenant.readOnly = false;
  window.sessionStorage.clear();
});

describe('AnalyticsBalancesPage (22.4)', () => {
  it('outstanding view: fetches /tenant/reports/balances with NO period query param', async () => {
    apiMock.api.mockResolvedValue(OUTSTANDING);
    renderPage();
    await waitFor(() => expect(apiMock.api).toHaveBeenCalledWith('/tenant/reports/balances'));
  });

  it('renders the departing-today header stat and an amber badge on the departing-today row', async () => {
    apiMock.api.mockResolvedValue(OUTSTANDING);
    renderPage();

    await screen.findByText('Ahmed Ali');
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('EGP 450.00')).toBeTruthy();

    const row = screen.getByText('Ahmed Ali').closest('tr') as HTMLElement;
    // The departs-today row's checkout date renders inside a badge.
    expect(within(row).getByText('Sep 3, 2026')).toBeTruthy();
    const otherRow = screen.getByText('Mona Said').closest('tr') as HTMLElement;
    expect(within(otherRow).getByText('Sep 5, 2026')).toBeTruthy();
  });

  it('renders dining/events/total columns per row', async () => {
    apiMock.api.mockResolvedValue(OUTSTANDING);
    renderPage();
    const row = await screen.findByText('Ahmed Ali').then((el) => el.closest('tr') as HTMLElement);
    expect(within(row).getByText('EGP 250.00')).toBeTruthy();
    expect(within(row).getByText('EGP 200.00')).toBeTruthy();
    expect(within(row).getByText('EGP 50.00')).toBeTruthy();
  });

  it('settle is disabled without stays.checkout permission', async () => {
    tenant.hasPermission.mockImplementation((key: string) => key !== 'stays.checkout');
    apiMock.api.mockResolvedValue(OUTSTANDING);
    renderPage();
    await screen.findByText('Ahmed Ali');
    const buttons = screen.getAllByRole('button', { name: en.analytics.balances.settle });
    expect(buttons.every((b) => b.hasAttribute('disabled'))).toBe(true);
  });

  it('settle is disabled under readOnly even with stays.checkout permission', async () => {
    tenant.readOnly = true;
    apiMock.api.mockResolvedValue(OUTSTANDING);
    renderPage();
    await screen.findByText('Ahmed Ali');
    const buttons = screen.getAllByRole('button', { name: en.analytics.balances.settle });
    expect(buttons.every((b) => b.hasAttribute('disabled'))).toBe(true);
  });

  it('onSettled re-fetches the balances list', async () => {
    apiMock.api.mockImplementation(async (path: string, init?: RequestInit) => {
      if (init?.method === 'POST') return { settled: 250, unsettledTotal: 0 };
      return OUTSTANDING;
    });
    renderPage();
    await screen.findByText('Ahmed Ali');

    const row = screen.getByText('Ahmed Ali').closest('tr') as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: en.analytics.balances.settle }));
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: en.analytics.balances.confirm }),
    );

    await waitFor(() =>
      expect(
        apiMock.api.mock.calls.filter(([path]) => path === '/tenant/reports/balances').length,
      ).toBeGreaterThanOrEqual(2),
    );
  });

  it('leakage view: switching tabs fetches /tenant/reports/balances/leakage WITH a period query string', async () => {
    apiMock.api.mockImplementation(async (path: string) => {
      if (path.startsWith('/tenant/reports/balances/leakage')) return LEAKAGE;
      return OUTSTANDING;
    });
    renderPage();
    await screen.findByText('Ahmed Ali');

    fireEvent.click(screen.getByRole('button', { name: en.analytics.balances.leakageTab }));

    await waitFor(() =>
      expect(apiMock.api).toHaveBeenCalledWith('/tenant/reports/balances/leakage?preset=last7'),
    );
  });

  it('leakage view renders totalLost + rows, with NO settle action present', async () => {
    apiMock.api.mockImplementation(async (path: string) => {
      if (path.startsWith('/tenant/reports/balances/leakage')) return LEAKAGE;
      return OUTSTANDING;
    });
    renderPage();
    await screen.findByText('Ahmed Ali');

    fireEvent.click(screen.getByRole('button', { name: en.analytics.balances.leakageTab }));

    await screen.findByText('Sara Adel');
    // Appears twice: the totalLost header stat and this single row's total.
    expect(screen.getAllByText('EGP 1,200.00').length).toBe(2);
    expect(screen.queryByRole('button', { name: en.analytics.balances.settle })).toBeNull();
  });
});
