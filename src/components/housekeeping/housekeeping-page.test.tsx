import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../messages/en';
import type {
  HousekeepingBoardCounts,
  HousekeepingRoomView,
} from '@/lib/types';

/**
 * Epic 20, Stories 20.2–20.4 — the housekeeping board. Same harness as
 * requests-page.test.tsx: mocked tenant context + api + housekeeping feed,
 * real English messages, no jest-dom matchers.
 */

const tenant = vi.hoisted(() => ({
  me: {
    user: { id: 'u1' },
    hotel: { defaultLanguage: 'ar', timezone: 'Africa/Cairo' },
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

const feed = vi.hoisted(() => ({
  rooms: null as HousekeepingRoomView[] | null,
  counts: null as HousekeepingBoardCounts | null,
  error: null,
  refresh: vi.fn(),
  applyRow: vi.fn(),
  boost: vi.fn(() => () => {}),
  onNewlyFlagged: vi.fn(() => () => {}),
}));

vi.mock('@/components/housekeeping/housekeeping-feed-provider', () => ({
  useHousekeepingFeed: () => feed,
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

import HousekeepingPage from '../../app/t/[slug]/(dashboard)/housekeeping/page';

let roomSeq = 0;

function makeRoom(
  overrides: Partial<HousekeepingRoomView> = {},
): HousekeepingRoomView {
  roomSeq += 1;
  return {
    id: `room-${roomSeq}`,
    roomNumber: String(100 + roomSeq),
    floor: 1,
    roomStatus: 'active',
    housekeepingStatus: 'needs_cleaning',
    cleaningType: 'checkout',
    occupied: true,
    assignedTo: null,
    lastCleanedAt: null,
    lastCleanedBy: null,
    updatedAt: '2026-08-29T08:00:00.000Z',
    ...overrides,
  };
}

function renderPage() {
  return render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Africa/Cairo">
      <HousekeepingPage />
    </NextIntlClientProvider>,
  );
}

afterEach(cleanup);

beforeEach(() => {
  roomSeq = 0;
  apiMock.api.mockReset();
  apiMock.api.mockImplementation(async () => []);
  tenant.hasPermission.mockReset();
  tenant.hasPermission.mockReturnValue(true);
  tenant.readOnly = false;
  feed.rooms = null;
  feed.counts = null;
  feed.boost.mockClear();
  feed.applyRow.mockClear();
  feed.onNewlyFlagged.mockClear();
});

describe('HousekeepingPage (20.2)', () => {
  it('permission gate: no housekeeping.read → EmptyState and zero API calls', () => {
    tenant.hasPermission.mockReturnValue(false);
    renderPage();
    expect(screen.getByText('No access to housekeeping')).toBeTruthy();
    expect(apiMock.api).not.toHaveBeenCalled();
    expect(feed.boost).not.toHaveBeenCalled();
  });

  it('AC1 — renders floor groups in order with the room cards inside', () => {
    feed.rooms = [
      makeRoom({ roomNumber: '101', floor: 1 }),
      makeRoom({ roomNumber: '201', floor: 2 }),
      makeRoom({ roomNumber: 'ANNEX', floor: null }),
    ];
    renderPage();
    expect(screen.getByRole('heading', { name: 'Floor 1' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Floor 2' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'No floor' })).toBeTruthy();
    expect(screen.getByTestId('hk-room-101')).toBeTruthy();
    expect(screen.getByTestId('hk-room-201')).toBeTruthy();
    expect(screen.getByTestId('hk-room-ANNEX')).toBeTruthy();
    // The null-floor group renders last.
    const headers = screen.getAllByRole('heading', { level: 2 });
    expect(headers[headers.length - 1].textContent).toBe('No floor');
  });

  it('AC1 — a card shows room number, cleaning-type chip, occupancy and assignee', () => {
    feed.rooms = [
      makeRoom({
        roomNumber: '204',
        cleaningType: 'checkout',
        occupied: true,
        assignedTo: { id: 'u2', name: 'Fatma' },
        roomStatus: 'out_of_service',
      }),
    ];
    renderPage();
    const card = screen.getByTestId('hk-room-204');
    const text = card.textContent ?? '';
    expect(text).toContain('204');
    expect(text).toContain('Checkout');
    expect(text).toContain('Fatma');
    expect(text).toContain('Out of service');
    expect(within(card).getByTitle('Occupied')).toBeTruthy();
  });

  it('AC2 — header stats: to-clean split, in progress, done today, DND', () => {
    feed.rooms = [];
    feed.counts = {
      toCleanCheckout: 3,
      toCleanDaily: 2,
      inProgress: 1,
      doneToday: 7,
      dnd: 4,
    };
    renderPage();
    expect(screen.getByText('To clean')).toBeTruthy();
    expect(screen.getByText('5')).toBeTruthy();
    expect(screen.getByText('3 checkout · 2 daily')).toBeTruthy();
    expect(screen.getByText('Done today')).toBeTruthy();
    expect(screen.getByText('7')).toBeTruthy();
    expect(screen.getByText('4')).toBeTruthy();
  });

  it('20.1 AC2 — checkout cleans sort before daily, then in-progress, then clean', () => {
    feed.rooms = [
      makeRoom({
        roomNumber: '101',
        housekeepingStatus: 'clean',
        cleaningType: null,
      }),
      makeRoom({ roomNumber: '102', cleaningType: 'daily' }),
      makeRoom({
        roomNumber: '103',
        housekeepingStatus: 'in_progress',
        cleaningType: 'checkout',
      }),
      makeRoom({ roomNumber: '104', cleaningType: 'checkout' }),
    ];
    renderPage();
    const order = screen
      .getAllByTestId(/hk-room-/)
      .map((el) => el.getAttribute('data-testid'));
    expect(order).toEqual([
      'hk-room-104',
      'hk-room-102',
      'hk-room-103',
      'hk-room-101',
    ]);
  });

  it('AC3 — "Unassigned only" narrows the grid', () => {
    feed.rooms = [
      makeRoom({ roomNumber: '101', assignedTo: { id: 'u2', name: 'Fatma' } }),
      makeRoom({ roomNumber: '102', assignedTo: null }),
    ];
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Unassigned only' }));
    expect(screen.queryByTestId('hk-room-101')).toBeNull();
    expect(screen.getByTestId('hk-room-102')).toBeTruthy();
  });

  it('20.3 AC1 — "My rooms" shows only rooms assigned to me', () => {
    feed.rooms = [
      makeRoom({ roomNumber: '101', assignedTo: { id: 'u1', name: 'Me' } }),
      makeRoom({ roomNumber: '102', assignedTo: { id: 'u2', name: 'Fatma' } }),
      makeRoom({ roomNumber: '103', assignedTo: null }),
    ];
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'My rooms' }));
    expect(screen.getByTestId('hk-room-101')).toBeTruthy();
    expect(screen.queryByTestId('hk-room-102')).toBeNull();
    expect(screen.queryByTestId('hk-room-103')).toBeNull();
  });

  it('AC3 — room search highlights the matching card without filtering the grid', () => {
    feed.rooms = [
      makeRoom({ roomNumber: '101' }),
      makeRoom({ roomNumber: '204' }),
    ];
    renderPage();
    fireEvent.change(screen.getByLabelText('Find a room by number'), {
      target: { value: '204' },
    });
    expect(
      screen.getByTestId('hk-room-204').className,
    ).toContain('ring-gold');
    // Not a filter — the other card stays on the grid.
    expect(screen.getByTestId('hk-room-101')).toBeTruthy();
    expect(screen.getByTestId('hk-room-101').className).not.toContain(
      'ring-gold',
    );
  });

  it('AC4 — the designed all-clean state when the board is empty', () => {
    feed.rooms = [];
    renderPage();
    expect(screen.getByText('All rooms are clean ✨')).toBeTruthy();
  });

  it('AC4 — filtered-empty is a distinct state with the clear-filters hint', () => {
    feed.rooms = [makeRoom({ housekeepingStatus: 'needs_cleaning' })];
    renderPage();
    fireEvent.change(screen.getByLabelText('All statuses'), {
      target: { value: 'dnd' },
    });
    expect(screen.getByText('No rooms match these filters')).toBeTruthy();
    expect(screen.queryByText('All rooms are clean ✨')).toBeNull();
  });
});

describe('RoomActionModal via board (20.3/20.4)', () => {
  it('readOnly disables the lifecycle actions in the modal', () => {
    tenant.readOnly = true;
    feed.rooms = [makeRoom({ roomNumber: '101' })];
    renderPage();
    fireEvent.click(screen.getByTestId('hk-room-101'));
    const start = screen.getByRole('button', {
      name: 'Start',
    }) as HTMLButtonElement;
    expect(start.disabled).toBe(true);
    expect(start.title).toContain('read-only');
  });

  it('a DND room shows its mark and the modal blocks Start with the explanation', () => {
    feed.rooms = [
      makeRoom({
        roomNumber: '305',
        housekeepingStatus: 'dnd',
        cleaningType: null,
      }),
    ];
    renderPage();
    const card = screen.getByTestId('hk-room-305');
    expect(card.textContent).toContain('Do not disturb');
    fireEvent.click(card);
    const start = screen.getByRole('button', {
      name: 'Start',
    }) as HTMLButtonElement;
    expect(start.disabled).toBe(true);
    expect(start.title).toContain('Do-Not-Disturb');
    // Assign and a parked flag stay available (20.4 AC2).
    expect(screen.getByRole('button', { name: 'Assign' })).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Flag for cleaning' }),
    ).toBeTruthy();
  });
});
