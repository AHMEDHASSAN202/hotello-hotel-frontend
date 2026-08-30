import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import en from '../../../messages/en';

/** Epic 16, Story 16.8 — room charge at checkout (visibility, not folio). */

const tenant = vi.hoisted(() => ({
  me: { user: { id: 'u1' }, hotel: { currency: 'EGP', timezone: 'Africa/Cairo' } },
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

/** A second stay for the switch-while-in-flight case (the drawer never unmounts). */
const STAY_B = {
  ...(STAY as Record<string, unknown>),
  id: 'stay-2',
  roomNumber: '512',
  guestName: 'Sara Nabil',
} as never;

const NO_FNB_ORDERS = { data: [], unsettledTotal: 0 };

function renderModal(stay: typeof STAY = STAY) {
  return render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Africa/Cairo">
      <StayDetailModal stay={stay} onClose={vi.fn()} onChanged={vi.fn()} />
    </NextIntlClientProvider>,
  );
}

function checkoutButton() {
  return screen.getByRole('button', { name: 'Check out' }) as HTMLButtonElement;
}

/** The confirm dialog's own button — last in the DOM, and never disabled. */
function confirmCheckoutButton() {
  const all = screen.getAllByRole('button', { name: 'Check out' });
  return all[all.length - 1];
}

beforeEach(() => {
  tenant.hasPermission.mockReset();
  tenant.hasPermission.mockReturnValue(true);
  tenant.isModuleEnabled.mockReset();
  tenant.isModuleEnabled.mockReturnValue(true);
  tenant.readOnly = false;
  tenant.me.hotel.currency = 'EGP';
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

  it('module off hides the F&B order-list section but the combined unsettled banner still fetches and renders (final-review Important 1)', async () => {
    tenant.isModuleEnabled.mockReturnValue(false);
    renderModal();
    await screen.findByText('Ahmed Ali');
    // The order-list card (F&B-module-gated) never appears.
    expect(
      apiMock.api.mock.calls.every(
        ([p]) => !String(p).includes('/tenant/fnb-orders'),
      ),
    ).toBe(true);
    // But the combined unsettled banner is a sibling section gated only on
    // the total itself, not on the F&B module — an events-only unsettled
    // balance (this fixture's mock returns total: 460 regardless) must
    // still be visible and actionable from the drawer body.
    expect(await screen.findByText(/Unsettled room charges:/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mark as settled' })).toBeTruthy();
    await waitFor(() => {
      expect(
        apiMock.api.mock.calls.some(([p]) =>
          String(p).endsWith('/tenant/stays/stay-1/unsettled'),
        ),
      ).toBe(true);
    });
  });

  it('reads the amount currency from the hotel record, not a hardcoded EGP (final-review Important 2)', async () => {
    tenant.me.hotel.currency = 'SAR';
    renderModal();
    // The unsettled banner and the checkout confirm both use the hotel's
    // real currency — a regression this task fixes would show "EGP" here
    // regardless of the hotel's actual currency.
    expect(await screen.findByText(/Unsettled room charges:.*SAR/)).toBeTruthy();
    expect(screen.queryByText(/Unsettled room charges:.*EGP/)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Check out' }));
    expect(await screen.findByText(/SAR.*uncollected room charges/)).toBeTruthy();
  });

  it('events-only unsettled balance with fnb disabled — banner renders with the events-only total (final-review Important 1)', async () => {
    tenant.isModuleEnabled.mockReturnValue(false);
    apiMock.api.mockImplementation(async (path: string) => {
      if (path.endsWith('/tenant/stays/stay-1/unsettled'))
        return { total: 150, byKey: { fnb: 0, events: 150 } };
      return {};
    });
    renderModal();
    await screen.findByText('Ahmed Ali');
    expect(await screen.findByText(/Unsettled room charges: EGP\s*150/)).toBeTruthy();
    expect(
      apiMock.api.mock.calls.every(
        ([p]) => !String(p).includes('/tenant/fnb-orders'),
      ),
    ).toBe(true);
  });

  it('failed unsettled fetch — warns, holds checkout, and recovers on retry (final-review money-correctness)', async () => {
    // A swallowed failure used to look exactly like "nothing owed": no
    // banner, and `checkout()` skipping the settle step — a transient 500
    // could check a stay out with uncollected room charges.
    apiMock.api.mockImplementation(async (path: string) => {
      if (path.endsWith('/tenant/stays/stay-1/unsettled'))
        throw new Error('boom');
      if (path.includes('/tenant/fnb-orders/stay/stay-1'))
        return { data: [RC_ORDER], unsettledTotal: 460 };
      return {};
    });
    renderModal();

    expect(
      await screen.findByText("We couldn't check for unpaid charges"),
    ).toBeTruthy();
    const checkoutButton = screen.getByRole('button', {
      name: 'Check out',
    }) as HTMLButtonElement;
    expect(checkoutButton.disabled).toBe(true);

    // Retry succeeds → the warning clears, the real total shows, and
    // checkout is available again.
    apiMock.api.mockImplementation(async (path: string) => {
      if (path.endsWith('/tenant/stays/stay-1/unsettled'))
        return { total: 610, byKey: { fnb: 460, events: 150 } };
      if (path.includes('/tenant/fnb-orders/stay/stay-1'))
        return { data: [RC_ORDER], unsettledTotal: 460 };
      return {};
    });
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(
      await screen.findByText(/Unsettled room charges: EGP\s*610/),
    ).toBeTruthy();
    await waitFor(() => {
      expect(
        screen.queryByText("We couldn't check for unpaid charges"),
      ).toBeNull();
      expect(
        (screen.getByRole('button', { name: 'Check out' }) as HTMLButtonElement)
          .disabled,
      ).toBe(false);
    });
  });

  it('while the check is IN FLIGHT — checkout is held and the state reads as pending, not failed (final-review Critical 1)', async () => {
    // The dangerous middle state: not failed, just unknown. A binary
    // failed/not-failed flag left checkout enabled for the whole round trip,
    // and `(unsettled?.total ?? 0) > 0` was false meanwhile — so a checkout
    // pressed here skipped the settle POST entirely and wrote the charges off.
    let resolveUnsettled: ((value: unknown) => void) | undefined;
    apiMock.api.mockImplementation(async (path: string) => {
      if (path.endsWith('/tenant/stays/stay-1/unsettled'))
        return new Promise((resolve) => {
          resolveUnsettled = resolve;
        });
      if (path.includes('/tenant/fnb-orders/stay/stay-1'))
        return { data: [RC_ORDER], unsettledTotal: 460 };
      return {};
    });
    renderModal();

    expect(await screen.findByText('Checking for unpaid charges…')).toBeTruthy();
    // The neutral pending affordance, NOT the red failure banner.
    expect(
      screen.queryByText("We couldn't check for unpaid charges"),
    ).toBeNull();
    expect(checkoutButton().disabled).toBe(true);

    await act(async () => {
      resolveUnsettled!({ total: 610, byKey: { fnb: 460, events: 150 } });
    });

    expect(
      await screen.findByText(/Unsettled room charges: EGP\s*610/),
    ).toBeTruthy();
    expect(screen.queryByText('Checking for unpaid charges…')).toBeNull();
    expect(checkoutButton().disabled).toBe(false);
  });

  it('Try again does not re-open checkout for the duration of the retry (final-review Critical 1)', async () => {
    // The widest instance of the hole: pressing retry used to clear the
    // failure flag on ENTRY, so checkout was enabled again for the whole
    // round trip — exactly when the endpoint is slow and about to fail again.
    apiMock.api.mockImplementation(async (path: string) => {
      if (path.endsWith('/tenant/stays/stay-1/unsettled'))
        throw new Error('boom');
      if (path.includes('/tenant/fnb-orders/stay/stay-1')) return NO_FNB_ORDERS;
      return {};
    });
    renderModal();
    await screen.findByText("We couldn't check for unpaid charges");

    let resolveRetry: ((value: unknown) => void) | undefined;
    apiMock.api.mockImplementation(async (path: string) => {
      if (path.endsWith('/tenant/stays/stay-1/unsettled'))
        return new Promise((resolve) => {
          resolveRetry = resolve;
        });
      if (path.includes('/tenant/fnb-orders/stay/stay-1')) return NO_FNB_ORDERS;
      return {};
    });
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    // The failure banner steps aside (nothing has failed yet) — but checkout
    // stays held, because the amount is still unknown.
    await waitFor(() =>
      expect(
        screen.queryByText("We couldn't check for unpaid charges"),
      ).toBeNull(),
    );
    expect(screen.getByText('Checking for unpaid charges…')).toBeTruthy();
    expect(checkoutButton().disabled).toBe(true);

    await act(async () => {
      resolveRetry!({ total: 610, byKey: { fnb: 610, events: 0 } });
    });
    expect(
      await screen.findByText(/Unsettled room charges: EGP\s*610/),
    ).toBeTruthy();
    expect(checkoutButton().disabled).toBe(false);
  });

  it('the in-function guard — a second confirm press while the amount is being re-verified issues no checkout (final-review Minor 1)', async () => {
    // The confirm dialog's button is never disabled, so the guard inside
    // `checkout()` is the only thing standing between a failed attempt and a
    // checkout that skips the settle step (`unsettled` is null again during
    // the re-verification, so the interlock would read "nothing owed").
    apiMock.api.mockImplementation(async (path: string) => {
      if (path.endsWith('/tenant/stays/stay-1/unsettled'))
        return { total: 610, byKey: { fnb: 460, events: 150 } };
      if (path.includes('/tenant/fnb-orders/stay/stay-1'))
        return { data: [RC_ORDER], unsettledTotal: 460 };
      return {};
    });
    renderModal();
    await screen.findByText(/Unsettled room charges:/);

    fireEvent.click(checkoutButton());
    await screen.findByText(/uncollected room charges/);

    // The attempt fails at the settle step and the re-verification it kicks
    // off hangs; the confirm dialog stays open with its error.
    let resolveRecheck: ((value: unknown) => void) | undefined;
    apiMock.api.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path.endsWith('/tenant/stays/stay-1/settle') && init?.method === 'POST')
        throw new Error('boom');
      if (path.endsWith('/tenant/stays/stay-1/unsettled'))
        return new Promise((resolve) => {
          resolveRecheck = resolve;
        });
      if (path.includes('/tenant/fnb-orders/stay/stay-1')) return NO_FNB_ORDERS;
      return {};
    });
    fireEvent.click(confirmCheckoutButton());
    await waitFor(() => expect(resolveRecheck).toBeTruthy());

    const checkoutPosts = () =>
      apiMock.api.mock.calls.filter(
        ([path, init]) =>
          String(path).endsWith('/tenant/stays/stay-1/checkout') &&
          (init as RequestInit | undefined)?.method === 'POST',
      ).length;
    expect(checkoutPosts()).toBe(0);

    fireEvent.click(confirmCheckoutButton());
    await act(async () => {
      await Promise.resolve();
    });
    // Still nothing: the guard refuses to check out an unverified balance.
    expect(checkoutPosts()).toBe(0);
  });

  it('a slow response from the stay we left never lands on the stay we are on (final-review Important 2)', async () => {
    // The drawer is permanently mounted (`Modal open={current !== null}`), so
    // switching stays re-runs the effect without an unmount: stay A's late
    // "nothing owed" used to unblock stay B's checkout with A's verdict.
    let resolveA: ((value: unknown) => void) | undefined;
    apiMock.api.mockImplementation(async (path: string) => {
      if (path.endsWith('/tenant/stays/stay-1/unsettled'))
        return new Promise((resolve) => {
          resolveA = resolve;
        });
      if (path.includes('/tenant/fnb-orders/stay/')) return NO_FNB_ORDERS;
      return {};
    });
    const { rerender } = renderModal();
    await screen.findByText('Checking for unpaid charges…');

    apiMock.api.mockImplementation(async (path: string) => {
      if (path.endsWith('/tenant/stays/stay-2/unsettled'))
        throw new Error('boom');
      if (path.includes('/tenant/fnb-orders/stay/')) return NO_FNB_ORDERS;
      return {};
    });
    rerender(
      <NextIntlClientProvider locale="en" messages={en} timeZone="Africa/Cairo">
        <StayDetailModal stay={STAY_B} onClose={vi.fn()} onChanged={vi.fn()} />
      </NextIntlClientProvider>,
    );
    await screen.findByText('Sara Nabil');
    await screen.findByText("We couldn't check for unpaid charges");

    await act(async () => {
      resolveA!({ total: 0, byKey: { fnb: 0, events: 0 } });
    });

    expect(
      screen.getByText("We couldn't check for unpaid charges"),
    ).toBeTruthy();
    expect(checkoutButton().disabled).toBe(true);
  });

  it('a checked-out stay is never told its check-out is on hold (final-review Minor 4)', async () => {
    apiMock.api.mockImplementation(async (path: string) => {
      if (path.endsWith('/tenant/stays/stay-1/unsettled'))
        throw new Error('boom');
      if (path.includes('/tenant/fnb-orders/stay/stay-1')) return NO_FNB_ORDERS;
      return {};
    });
    renderModal({
      ...(STAY as Record<string, unknown>),
      status: 'checked_out',
      checkedOutAt: '2026-08-25T09:00:00Z',
      checkoutType: 'manual',
    } as never);

    await screen.findByText('Ahmed Ali');
    await waitFor(() =>
      expect(
        apiMock.api.mock.calls.some(([p]) =>
          String(p).endsWith('/tenant/stays/stay-1/unsettled'),
        ),
      ).toBe(true),
    );
    // There is no Check out button on a closed record, so a banner saying
    // check-out is on hold points at nothing.
    expect(screen.queryByRole('button', { name: 'Check out' })).toBeNull();
    expect(
      screen.queryByText("We couldn't check for unpaid charges"),
    ).toBeNull();
    expect(screen.queryByText('Checking for unpaid charges…')).toBeNull();
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
