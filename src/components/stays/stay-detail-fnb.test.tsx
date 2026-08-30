import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import en from '../../../messages/en';

/** Epic 16, Story 16.8 — room charge at checkout (visibility, not folio). */

const tenant = vi.hoisted(() => ({
  me: { user: { id: 'u1' }, hotel: { timezone: 'Africa/Cairo' } },
  hasPermission: vi.fn(() => true),
  isModuleEnabled: vi.fn(() => true),
  readOnly: false,
  isHintDismissed: vi.fn(() => true),
  dismissHint: vi.fn(),
  undismissHint: vi.fn(),
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

import { StayDetailModal } from './stay-detail-modal';

const STAY = {
  id: 'stay-1',
  roomId: 'r1',
  roomNumber: '304',
  floor: 3,
  guestName: 'Ahmed Ali',
  email: null,
  phone: null,
  language: 'ar',
  guestsCount: null,
  note: null,
  stayType: 'all_inclusive',
  checkInDate: '2026-08-20',
  checkOutDate: '2026-08-25',
  nightsRemaining: 3,
  status: 'active',
  checkoutType: null,
  checkedOutAt: null,
  createdAt: '2026-08-20T10:00:00Z',
} as never;

const RC_ORDER = {
  id: 'o1',
  createdAt: '2026-08-21T18:00:00Z',
  totalAmount: 460,
  currency: 'EGP',
  paymentMethod: 'room_charge',
  status: 'delivered',
  settledAt: null,
};

function renderModal() {
  return render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Africa/Cairo">
      <StayDetailModal stay={STAY} onClose={vi.fn()} onChanged={vi.fn()} />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  tenant.hasPermission.mockReset();
  tenant.hasPermission.mockReturnValue(true);
  tenant.isModuleEnabled.mockReset();
  tenant.isModuleEnabled.mockReturnValue(true);
  tenant.readOnly = false;
  apiMock.api.mockReset();
  apiMock.api.mockImplementation(async (path: string) => {
    if (path.includes('/tenant/fnb-orders/stay/stay-1'))
      return { data: [RC_ORDER], unsettledTotal: 460 };
    if (path.endsWith('/tenant/stays/stay-1/unsettled'))
      return { total: 460, byKey: { fnb: 460, events: 0 } };
    return {};
  });
});

describe('StayDetailModal — F&B orders (16.8) + combined settlement (21.6 AC2)', () => {
  it('AC1 — lists the orders and surfaces the combined unsettled sum', async () => {
    renderModal();
    expect(
      await screen.findByText(/Unsettled room charges:/),
    ).toBeTruthy();
    expect(screen.getAllByText(/460/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('On the room bill')).toBeTruthy();
  });

  it('21.6 AC2 — the unsettled total comes from the combined stays endpoint, not the F&B-only one', async () => {
    apiMock.api.mockImplementation(async (path: string) => {
      if (path.includes('/tenant/fnb-orders/stay/stay-1'))
        return { data: [RC_ORDER], unsettledTotal: 1000 };
      if (path.endsWith('/tenant/stays/stay-1/unsettled'))
        return { total: 610, byKey: { fnb: 460, events: 150 } };
      return {};
    });
    renderModal();
    // 610 (the combined total), not 1000 (the stale F&B-only figure).
    expect(await screen.findByText(/Unsettled room charges: EGP\s*610/)).toBeTruthy();
    expect(screen.queryByText(/1,?000/)).toBeNull();
  });

  it('AC2 — the checkout confirm includes the combined uncollected sum, the byKey breakdown, and settles before checkout', async () => {
    // Mixed sources (F&B + events both unsettled) so the breakdown line renders.
    apiMock.api.mockImplementation(async (path: string) => {
      if (path.includes('/tenant/fnb-orders/stay/stay-1'))
        return { data: [RC_ORDER], unsettledTotal: 460 };
      if (path.endsWith('/tenant/stays/stay-1/unsettled'))
        return { total: 610, byKey: { fnb: 460, events: 150 } };
      return {};
    });
    renderModal();
    await screen.findByText(/Unsettled room charges:/);

    fireEvent.click(screen.getByRole('button', { name: 'Check out' }));
    expect(
      await screen.findByText(/uncollected room charges/),
    ).toBeTruthy();
    // Mixed F&B + events sources → the breakdown line renders.
    expect(await screen.findByText(/F&B EGP\s*460.*Events EGP\s*150/)).toBeTruthy();

    apiMock.api.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path.endsWith('/tenant/stays/stay-1/settle'))
        return { settled: 1, unsettledTotal: 0 };
      if (path.includes('/checkout') && init?.method === 'POST')
        return { ...STAY, status: 'checked_out' };
      if (path.includes('/tenant/fnb-orders/stay/stay-1'))
        return { data: [], unsettledTotal: 0 };
      if (path.endsWith('/tenant/stays/stay-1/unsettled'))
        return { total: 0, byKey: { fnb: 0, events: 0 } };
      return {};
    });
    const confirmButtons = screen.getAllByRole('button', {
      name: 'Check out',
    });
    fireEvent.click(confirmButtons[confirmButtons.length - 1]);

    await waitFor(() => {
      const paths = apiMock.api.mock.calls.map(([p]) => String(p));
      const settleIdx = paths.findIndex((p) => p.endsWith('/tenant/stays/stay-1/settle'));
      const checkoutIdx = paths.findIndex((p) => p.endsWith('/tenant/stays/stay-1/checkout'));
      expect(settleIdx).toBeGreaterThan(-1);
      expect(checkoutIdx).toBeGreaterThan(settleIdx);
    });
  });

  it('module off still fetches the combined unsettled total but hides the F&B order-list section', async () => {
    tenant.isModuleEnabled.mockReturnValue(false);
    renderModal();
    await screen.findByText('Ahmed Ali');
    expect(screen.queryByText(/Unsettled room charges/)).toBeNull();
    expect(
      apiMock.api.mock.calls.every(
        ([p]) => !String(p).includes('/tenant/fnb-orders'),
      ),
    ).toBe(true);
    await waitFor(() => {
      expect(
        apiMock.api.mock.calls.some(([p]) =>
          String(p).endsWith('/tenant/stays/stay-1/unsettled'),
        ),
      ).toBe(true);
    });
  });

  it('no checkout permission — the combined unsettled endpoint is never called', async () => {
    tenant.hasPermission.mockImplementation((key: string) => key !== 'stays.checkout');
    renderModal();
    await screen.findByText('Ahmed Ali');
    expect(
      apiMock.api.mock.calls.every(
        ([p]) => !String(p).endsWith('/tenant/stays/stay-1/unsettled'),
      ),
    ).toBe(true);
  });
});
