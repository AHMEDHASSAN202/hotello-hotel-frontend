import { render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../../../../../../messages/en';
import type { EventAttendeesResponse, TenantEventBooking } from '@/lib/types';

/** Epic 21, Story 21.6 AC1 — the attendees drill-in page (Task 15). */

const tenant = vi.hoisted(() => ({
  me: { user: { id: 'u1' }, hotel: { currency: 'EGP', timezone: 'Africa/Cairo' } },
  hasPermission: vi.fn(() => true),
}));

vi.mock('@/components/tenant-provider', () => ({ useTenant: () => tenant }));

vi.mock('next/navigation', () => ({
  useParams: () => ({ slug: 'sunrise', id: 'evt-1' }),
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

import EventAttendeesPage from './page';

const makeBooking = (o: Partial<TenantEventBooking> = {}): TenantEventBooking => ({
  guestName: 'Amina Farouk',
  roomNumber: '204',
  partySize: 2,
  paymentMethod: 'cash',
  bookedAt: '2026-01-15T08:00:00.000Z',
  status: 'booked',
  ...o,
});

const makeResponse = (
  o: Partial<EventAttendeesResponse> = {},
): EventAttendeesResponse => ({
  event: {
    id: 'evt-1',
    titles: { en: 'Sunset Yoga', ar: 'يوجا الغروب' },
    descriptions: { en: 'Beachside session', ar: 'جلسة على الشاطئ' },
    photoThumbUrl: null,
    photoDetailUrl: null,
    startAtLocal: '2030-01-01 09:00',
    endAtLocal: null,
    locationText: 'Beach — Building B',
    infoEntryId: null,
    capacity: 10,
    price: 100,
    includedFor: [],
    status: 'published',
    cancelReason: null,
    createdAt: '2026-01-15T08:00:00.000Z',
    updatedAt: '2026-01-15T09:00:00.000Z',
  },
  bookings: [makeBooking()],
  totals: { booked: 2, capacity: 10, expectedCash: 200, expectedRoomCharge: 0 },
  ...o,
});

function stubApi(response: EventAttendeesResponse) {
  apiMock.api.mockImplementation(async (path: string) => {
    if (path === '/tenant/events/evt-1/attendees') return response;
    throw new Error(`unmocked GET ${path}`);
  });
}

function renderPage() {
  return render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Africa/Cairo">
      <EventAttendeesPage />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  tenant.hasPermission.mockReturnValue(true);
});

describe('EventAttendeesPage', () => {
  it('no events.read permission → the gated empty state, no data load', () => {
    tenant.hasPermission.mockReturnValue(false);
    stubApi(makeResponse());
    renderPage();
    expect(screen.getByText(en.events.noAccess.title)).toBeTruthy();
    expect(apiMock.api).not.toHaveBeenCalled();
  });

  it('renders the event header, live totals, and booking rows incl. a cancelled one', async () => {
    stubApi(
      makeResponse({
        bookings: [
          makeBooking({ guestName: 'Amina Farouk', roomNumber: '204', partySize: 2, paymentMethod: 'cash', status: 'booked' }),
          makeBooking({ guestName: 'Youssef Adel', roomNumber: '512', partySize: 1, paymentMethod: 'room_charge', status: 'cancelled' }),
          makeBooking({ guestName: 'Lina Kamel', roomNumber: '108', partySize: 3, paymentMethod: null, status: 'booked' }),
        ],
        totals: { booked: 5, capacity: 10, expectedCash: 200, expectedRoomCharge: 0 },
      }),
    );
    renderPage();

    expect(await screen.findByText('Sunset Yoga')).toBeTruthy();
    expect(apiMock.api).toHaveBeenCalledWith('/tenant/events/evt-1/attendees');

    // Header totals — booked/capacity fraction (mirrors the list page's format).
    expect(screen.getByText('5 / 10')).toBeTruthy();
    // Expected cash/room-charge stat tiles render a formatted currency amount.
    expect(screen.getAllByText(/200/).length).toBeGreaterThan(0);

    // Scope row assertions to the table — "Booked" is also the totals-tile
    // label, so an unscoped query would double-count it.
    const table = within(screen.getByTestId('attendees-table'));

    // Guest rows — name and room share a <td>, so match by substring.
    expect(table.getByText(/Amina Farouk/)).toBeTruthy();
    expect(table.getByText(/Youssef Adel/)).toBeTruthy();
    expect(table.getByText(/Lina Kamel/)).toBeTruthy();

    // Payment badges: cash, room charge, included.
    expect(table.getByText(en.events.attendees.payment.cash)).toBeTruthy();
    expect(table.getByText(en.events.attendees.payment.roomCharge)).toBeTruthy();
    expect(table.getByText(en.events.attendees.payment.included)).toBeTruthy();

    // Booking-status badges — the cancelled row is visibly distinguished.
    expect(table.getAllByText(en.events.attendees.bookingStatus.booked).length).toBe(2);
    expect(table.getAllByText(en.events.attendees.bookingStatus.cancelled).length).toBe(1);
  });

  it('an event with zero bookings shows the designed empty state', async () => {
    stubApi(makeResponse({ bookings: [], totals: { booked: 0, capacity: 10, expectedCash: 0, expectedRoomCharge: 0 } }));
    renderPage();
    expect(await screen.findByText('Sunset Yoga')).toBeTruthy();
    expect(screen.getByText(en.events.attendees.empty.title)).toBeTruthy();
  });
});
