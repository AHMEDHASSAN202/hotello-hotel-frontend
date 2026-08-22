import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import en from '../../../../../../messages/en';

/** Epic 16, Story 16.7 — the kitchen board. Requests-board harness pattern. */

const tenant = vi.hoisted(() => ({
  me: {
    user: { id: 'u1' },
    hotel: { defaultLanguage: 'ar', currency: 'EGP', timezone: 'Africa/Cairo' },
  },
  hasPermission: vi.fn(() => true),
  readOnly: false,
  isHintDismissed: vi.fn(() => true),
  dismissHint: vi.fn(),
  undismissHint: vi.fn(),
}));

vi.mock('@/components/tenant-provider', () => ({
  useTenant: () => tenant,
}));

vi.mock('next/navigation', () => ({
  useParams: () => ({ slug: 'sunrise' }),
}));

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

const feed = vi.hoisted(() => ({
  orders: null as unknown[] | null,
  counts: null as Record<string, number> | null,
  error: null,
  refresh: vi.fn(),
  applyRow: vi.fn(),
  boost: vi.fn(() => () => {}),
  onNewOrders: vi.fn(() => () => {}),
}));

vi.mock('@/components/fnb/fnb-feed-provider', () => ({
  useFnbFeed: () => feed,
}));

import FnbBoardPage from './page';

const futureIso = (minutes: number) =>
  new Date(Date.now() + minutes * 60_000).toISOString();

const ORDER = {
  id: 'o1',
  roomNumber: '304',
  guestName: 'Ahmed Ali',
  guestLanguage: 'ru',
  stayId: 'stay-1',
  destinationType: 'location',
  locationId: 'loc-1',
  locationNameEn: 'Pool',
  locationNameAr: 'المسبح',
  spot: '12',
  paymentMethod: 'cash',
  totalAmount: 230,
  currency: 'EGP',
  status: 'new',
  slaTargetMinutes: 30,
  dueAt: futureIso(25),
  menuIds: ['menu-1'],
  assignedTo: null,
  createdAt: new Date(Date.now() - 5 * 60_000).toISOString(),
  startedAt: null,
  outForDeliveryAt: null,
  deliveredAt: null,
  cancelledAt: null,
  cancelledReason: null,
  cancelNote: null,
  settledAt: null,
  updatedAt: new Date().toISOString(),
  lines: [
    {
      id: 'l1',
      itemNameEn: 'Burger',
      itemNameAr: 'برجر',
      itemName: 'Бургер',
      variantOptionNameEn: 'Large',
      variantOptionNameAr: 'كبير',
      quantity: 2,
      unitPrice: 115,
      included: false,
      lineTotal: 230,
      note: 'без лука',
    },
  ],
};

function renderPage() {
  return render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Africa/Cairo">
      <FnbBoardPage />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  tenant.hasPermission.mockReset();
  tenant.hasPermission.mockReturnValue(true);
  tenant.readOnly = false;
  apiMock.api.mockReset();
  apiMock.api.mockImplementation(async (path: string) => {
    if (path.includes('fnb-menus'))
      return { menus: [{ id: 'menu-1', names: { en: 'Pool Bar', ar: 'بار' }, sections: [] }] };
    if (path.includes('fnb-locations'))
      return { locations: [{ id: 'loc-1', key: 'pool', names: { en: 'Pool', ar: 'المسبح' }, hasSpots: true, spotLabel: null, isActive: true, sortOrder: 0 }] };
    if (path.includes('assignees')) return [];
    return { data: [], total: 0, page: 1, pageSize: 20 };
  });
  feed.orders = [ORDER];
  feed.counts = { open: 3, deliveredToday: 7, overdueNow: 1, revenueToday: 460.5 };
});

describe('FnbBoardPage (16.7)', () => {
  it('without fnb_orders.read renders the noAccess EmptyState and calls no API', async () => {
    tenant.hasPermission.mockReturnValue(false);
    renderPage();
    expect(
      await screen.findByText("You don't have access to F&B orders"),
    ).toBeTruthy();
    expect(apiMock.api).not.toHaveBeenCalled();
  });

  it('AC1 — the ticket shows destination prominently, lines, payment chip, guest + room', async () => {
    renderPage();
    const card = await screen.findByTestId('fnb-order-card-o1');
    const text = card.textContent ?? '';
    expect(text).toContain('Pool · 12'); // destination headline
    expect(text).toContain('2×');
    expect(text).toContain('Burger');
    expect(text).toContain('Large');
    expect(text).toContain('без лука'); // note verbatim
    expect(text).toContain('ru'); // guest-language tag (CSS uppercases)
    expect(text).toContain('Ahmed Ali');
    expect(text).toContain('304');
    expect(text).toMatch(/Cash: .*230/);
  });

  it('AC3 — the stats header shows open / delivered / formatted paid revenue', async () => {
    renderPage();
    expect(await screen.findByText('Paid revenue today')).toBeTruthy();
    // Formatted currency (Latin digits) with the decimal preserved.
    expect(screen.getByText(/460\.50?/)).toBeTruthy();
    expect(screen.getByText('Delivered today')).toBeTruthy();
  });

  it('AC3 — the destination filter narrows to locations', async () => {
    feed.orders = [
      ORDER,
      { ...ORDER, id: 'o2', destinationType: 'room', locationId: null, locationNameEn: null, locationNameAr: null, spot: null },
    ];
    renderPage();
    await screen.findByTestId('fnb-order-card-o1');
    expect(screen.getByTestId('fnb-order-card-o2')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('All destinations'), {
      target: { value: 'room' },
    });
    expect(screen.queryByTestId('fnb-order-card-o1')).toBeNull();
    expect(screen.getByTestId('fnb-order-card-o2')).toBeTruthy();
  });

  it('overdue orders float to the top of the board', async () => {
    feed.orders = [
      ORDER,
      {
        ...ORDER,
        id: 'o-late',
        dueAt: new Date(Date.now() - 10 * 60_000).toISOString(),
        createdAt: new Date(Date.now() - 60 * 60_000).toISOString(),
      },
    ];
    renderPage();
    const cards = await screen.findAllByTestId(/fnb-order-card-/);
    expect(cards[0].getAttribute('data-testid')).toBe('fnb-order-card-o-late');
  });

  it('a fully-included order shows the ✓ Included chip instead of an amount', async () => {
    feed.orders = [
      { ...ORDER, id: 'o3', totalAmount: 0, paymentMethod: null,
        lines: [{ ...ORDER.lines[0], included: true, unitPrice: 0, lineTotal: 0 }] },
    ];
    renderPage();
    const card = await screen.findByTestId('fnb-order-card-o3');
    expect(card.textContent).toContain('✓ Included');
    expect(card.textContent).not.toMatch(/Cash:/);
  });
});
