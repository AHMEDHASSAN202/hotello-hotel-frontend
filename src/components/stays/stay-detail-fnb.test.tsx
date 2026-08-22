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
    return {};
  });
});

describe('StayDetailModal — F&B orders (16.8)', () => {
  it('AC1 — lists the orders and surfaces the unsettled room-charge sum', async () => {
    renderModal();
    expect(
      await screen.findByText(/Unsettled room charges:/),
    ).toBeTruthy();
    expect(screen.getAllByText(/460/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('On the room bill')).toBeTruthy();
  });

  it('AC2 — the checkout confirm includes the uncollected sum and settles before checkout', async () => {
    renderModal();
    await screen.findByText(/Unsettled room charges:/);

    fireEvent.click(screen.getByRole('button', { name: 'Check out' }));
    expect(
      await screen.findByText(/uncollected room-charge orders/),
    ).toBeTruthy();

    apiMock.api.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path.includes('/settle')) return { settled: 1, unsettledTotal: 0 };
      if (path.includes('/checkout') && init?.method === 'POST')
        return { ...STAY, status: 'checked_out' };
      if (path.includes('/tenant/fnb-orders/stay/stay-1'))
        return { data: [], unsettledTotal: 0 };
      return {};
    });
    const confirmButtons = screen.getAllByRole('button', {
      name: 'Check out',
    });
    fireEvent.click(confirmButtons[confirmButtons.length - 1]);

    await waitFor(() => {
      const paths = apiMock.api.mock.calls.map(([p]) => String(p));
      const settleIdx = paths.findIndex((p) => p.includes('/settle'));
      const checkoutIdx = paths.findIndex((p) => p.includes('/checkout'));
      expect(settleIdx).toBeGreaterThan(-1);
      expect(checkoutIdx).toBeGreaterThan(settleIdx);
    });
  });

  it('module off hides the orders section entirely and skips the fetch', async () => {
    tenant.isModuleEnabled.mockReturnValue(false);
    renderModal();
    await screen.findByText('Ahmed Ali');
    expect(screen.queryByText(/Unsettled room charges/)).toBeNull();
    expect(
      apiMock.api.mock.calls.every(
        ([p]) => !String(p).includes('/tenant/fnb-orders'),
      ),
    ).toBe(true);
  });
});
