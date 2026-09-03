import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import en from '../../../messages/en';

/**
 * Epic 11, Story 11.2 (rooms list) + Story 11.6 AC4 (onboarding empty state).
 * Mirrors the staff-page harness (staff-empty-states.test.tsx): mocked tenant
 * context + api, real English messages, no jest-dom matchers.
 */

const tenant = vi.hoisted(() => ({
  me: { user: { id: 'u1' }, hotel: { currency: 'EGP' } },
  hasPermission: vi.fn(() => true),
  readOnly: false,
  isHintDismissed: vi.fn(() => true), // hide the first-run HintCard here
  dismissHint: vi.fn(),
}));

vi.mock('@/components/tenant-provider', () => ({
  useTenant: () => tenant,
}));

// Task F2d, Part 4 — `hasBalance` seeding from the URL (Task F1b's
// useSeededFilters); `nav.hasBalance` is set per-test, defaulting to absent.
const nav = vi.hoisted(() => ({ hasBalance: null as string | null }));

vi.mock('next/navigation', () => ({
  useParams: () => ({ slug: 'sunrise' }),
  useSearchParams: () => ({
    get: (key: string) => (key === 'hasBalance' ? nav.hasBalance : null),
  }),
}));

const apiMock = vi.hoisted(() => ({
  api: vi.fn(),
  apiUpload: vi.fn(),
  apiBlob: vi.fn(),
  saveBlob: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  api: apiMock.api,
  apiUpload: apiMock.apiUpload,
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

import RoomsPage from '../../app/t/[slug]/(dashboard)/rooms/page';

const ROOM_TYPE = { id: 't1', nameEn: 'Deluxe', nameAr: 'ديلوكس' };

function mockRoomsResponse(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    data: [],
    total: 0,
    page: 1,
    pageSize: 50,
    usage: { used: 0, max: null },
    ...overrides,
  };
}

function renderPage() {
  return render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Africa/Cairo">
      <RoomsPage />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  tenant.hasPermission.mockReset();
  tenant.hasPermission.mockReturnValue(true);
  tenant.readOnly = false;
  nav.hasBalance = null;
  apiMock.api.mockReset();
  apiMock.apiUpload.mockReset();
  apiMock.apiBlob.mockReset();
  apiMock.saveBlob.mockReset();
});

describe('RoomsPage (11.2)', () => {
  it('AC1 — without rooms.read renders the noAccess EmptyState and calls no API', async () => {
    tenant.hasPermission.mockReturnValue(false);
    renderPage();

    expect(
      await screen.findByText("You don't have access to rooms"),
    ).toBeTruthy();
    expect(apiMock.api).not.toHaveBeenCalled();
  });

  it('AC2 — renders table rows with room number, floor, localized type, status Badge + InfoTip', async () => {
    apiMock.api.mockImplementation(async (path: string) => {
      if (path.startsWith('/tenant/room-types')) return { data: [ROOM_TYPE] };
      return mockRoomsResponse({
        data: [
          {
            id: 'r1',
            roomNumber: '101',
            floor: 3,
            status: 'out_of_service',
            roomType: ROOM_TYPE,
          },
        ],
        total: 1,
      });
    });
    const { container } = renderPage();

    await screen.findByText('101');
    const code = container.querySelector('code');
    expect(code?.textContent).toBe('101');
    expect(code?.getAttribute('dir')).toBe('ltr');

    const row = screen.getByText('101').closest('tr');
    expect(row).toBeTruthy();
    expect(within(row as HTMLElement).getByText('3')).toBeTruthy();
    expect(within(row as HTMLElement).getByText('Deluxe')).toBeTruthy();
    expect(within(row as HTMLElement).getByText('Out of service')).toBeTruthy();

    const tip = screen.getByRole('button', { name: 'Out of service' });
    fireEvent.click(tip);
    expect(
      screen.getByText(
        "Temporarily unavailable to guests — use this for rooms under maintenance. Still counts toward your plan's room limit.",
      ),
    ).toBeTruthy();
  });

  it('AC3 — usage header shows "84 / 100" and turns amber at >80%', async () => {
    apiMock.api.mockImplementation(async (path: string) => {
      if (path.startsWith('/tenant/room-types')) return { data: [] };
      return mockRoomsResponse({ usage: { used: 84, max: 100 } });
    });
    renderPage();

    const usage = await screen.findByText('84 / 100 rooms');
    expect(usage.className).toMatch(/amber/);
  });

  it('AC4(11.6) — zero rooms + no filters shows onboarding EmptyState with Add-rooms action', async () => {
    apiMock.api.mockImplementation(async (path: string) => {
      if (path.startsWith('/tenant/room-types')) return { data: [] };
      return mockRoomsResponse();
    });
    renderPage();

    expect(await screen.findByText('No rooms yet')).toBeTruthy();
    expect(
      screen.getByText('Add your rooms to activate guest services.'),
    ).toBeTruthy();
    // Header button + the empty state's own CTA.
    expect(
      screen.getAllByRole('button', { name: 'Add room' }).length,
    ).toBeGreaterThanOrEqual(2);
  });

  it('filtered to zero shows the noMatch EmptyState with a clear-filters action', async () => {
    apiMock.api.mockImplementation(async (path: string) => {
      if (path.startsWith('/tenant/room-types')) return { data: [] };
      return mockRoomsResponse();
    });
    renderPage();
    await screen.findByText('No rooms yet');

    fireEvent.change(screen.getByLabelText('Filter by status'), {
      target: { value: 'active' },
    });

    expect(
      await screen.findByText('No rooms match your filters'),
    ).toBeTruthy();
    expect(screen.queryByText('No rooms yet')).toBeNull();

    const clearButtons = screen.getAllByRole('button', {
      name: 'Clear filters',
    });
    expect(clearButtons.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(clearButtons[0]);
    expect(await screen.findByText('No rooms yet')).toBeTruthy();
  });

  it('readOnly disables the Add rooms button', async () => {
    tenant.readOnly = true;
    apiMock.api.mockImplementation(async (path: string) => {
      if (path.startsWith('/tenant/room-types')) return { data: [ROOM_TYPE] };
      return mockRoomsResponse({
        data: [
          {
            id: 'r1',
            roomNumber: '101',
            floor: null,
            status: 'active',
            roomType: ROOM_TYPE,
          },
        ],
        total: 1,
      });
    });
    renderPage();

    const button = await screen.findByRole('button', { name: 'Add room' });
    expect(button.hasAttribute('disabled')).toBe(true);
  });

  it('11.7 AC1 — Export passes the active filters, not pagination, and stays enabled under readOnly', async () => {
    tenant.readOnly = true;
    apiMock.api.mockImplementation(async (path: string) => {
      if (path.startsWith('/tenant/room-types')) return { data: [ROOM_TYPE] };
      return mockRoomsResponse();
    });
    renderPage();
    await screen.findByText('No rooms yet');

    fireEvent.change(screen.getByLabelText('Filter by status'), {
      target: { value: 'active' },
    });
    await screen.findByText('No rooms match your filters');

    const exportButton = screen.getByRole('button', { name: 'Export to Excel' });
    expect(exportButton.hasAttribute('disabled')).toBe(false);

    apiMock.apiBlob.mockResolvedValueOnce({
      blob: new Blob(['x']),
      filename: 'rooms.xlsx',
    });
    fireEvent.click(exportButton);

    await waitFor(() => expect(apiMock.apiBlob).toHaveBeenCalled());
    const [path] = apiMock.apiBlob.mock.calls[0];
    expect(path).toBe('/tenant/rooms/export?status=active');
    expect(apiMock.saveBlob).toHaveBeenCalled();
  });

  it('13.2 AC3 — an occupied room shows the badge and the guest InfoTip', async () => {
    apiMock.api.mockImplementation(async (path: string) => {
      if (path.startsWith('/tenant/room-types')) return { data: [ROOM_TYPE] };
      return mockRoomsResponse({
        data: [
          {
            id: 'r1',
            roomNumber: '101',
            floor: 1,
            status: 'active',
            roomType: ROOM_TYPE,
            currentStay: {
              id: 's1',
              guestName: 'Ahmed Ali',
              checkOutDate: '2026-08-25',
            },
          },
          {
            id: 'r2',
            roomNumber: '102',
            floor: 1,
            status: 'active',
            roomType: ROOM_TYPE,
            currentStay: null,
          },
        ],
        total: 2,
      });
    });
    renderPage();

    await screen.findByText('Occupied');
    expect(screen.getByText('Vacant')).toBeTruthy();

    // The InfoTip carries guest name + checkout date (13.2 AC3).
    fireEvent.click(screen.getByRole('button', { name: 'Occupied' }));
    expect(screen.getByText(/Ahmed Ali — checks out/)).toBeTruthy();
  });

  it('13.2 AC3 — without stays.read (field absent) no occupancy badge renders', async () => {
    apiMock.api.mockImplementation(async (path: string) => {
      if (path.startsWith('/tenant/room-types')) return { data: [ROOM_TYPE] };
      return mockRoomsResponse({
        data: [
          {
            id: 'r1',
            roomNumber: '101',
            floor: 1,
            status: 'active',
            roomType: ROOM_TYPE,
            // no currentStay field — the API omits it for this actor
          },
        ],
        total: 1,
      });
    });
    renderPage();

    await screen.findByText('101');
    expect(screen.queryByText('Occupied')).toBeNull();
    expect(screen.queryByText('Vacant')).toBeNull();
  });

  it('11.7 — Import and Download-template buttons are disabled under readOnly', async () => {
    tenant.readOnly = true;
    apiMock.api.mockImplementation(async (path: string) => {
      if (path.startsWith('/tenant/room-types')) return { data: [ROOM_TYPE] };
      return mockRoomsResponse();
    });
    renderPage();
    await screen.findByText('No rooms yet');

    expect(
      screen.getByRole('button', { name: 'Import from Excel' }).hasAttribute('disabled'),
    ).toBe(true);
    expect(
      screen.getByRole('button', { name: 'Download template' }).hasAttribute('disabled'),
    ).toBe(true);
  });

  it('22.4 AC4 — checking "Has balance" adds hasBalance=true to the rooms request', async () => {
    apiMock.api.mockImplementation(async (path: string) => {
      if (path.startsWith('/tenant/room-types')) return { data: [] };
      return mockRoomsResponse();
    });
    renderPage();
    await screen.findByText('No rooms yet');
    apiMock.api.mockClear();

    fireEvent.click(screen.getByLabelText('Has balance'));

    await waitFor(() =>
      expect(apiMock.api).toHaveBeenCalledWith(
        expect.stringContaining('hasBalance=true'),
      ),
    );
  });

  it('22.4 AC4 — a danger balance badge renders only when unsettledTotal is present AND > 0', async () => {
    apiMock.api.mockImplementation(async (path: string) => {
      if (path.startsWith('/tenant/room-types')) return { data: [ROOM_TYPE] };
      return mockRoomsResponse({
        data: [
          { id: 'r1', roomNumber: '101', floor: 1, status: 'active', roomType: ROOM_TYPE, unsettledTotal: 250 },
          { id: 'r2', roomNumber: '102', floor: 1, status: 'active', roomType: ROOM_TYPE, unsettledTotal: 0 },
          { id: 'r3', roomNumber: '103', floor: 1, status: 'active', roomType: ROOM_TYPE },
        ],
        total: 3,
      });
    });
    renderPage();

    await screen.findByText('101');
    expect(screen.getByText('EGP 250.00')).toBeTruthy();
    expect(screen.getAllByText('EGP 250.00').length).toBe(1);
  });

  it('22.4 AC4 — seeds the hasBalance filter checkbox from ?hasBalance=true in the URL', async () => {
    nav.hasBalance = 'true';
    apiMock.api.mockImplementation(async (path: string) => {
      if (path.startsWith('/tenant/room-types')) return { data: [] };
      return mockRoomsResponse();
    });
    renderPage();

    const checkbox = (await screen.findByLabelText('Has balance')) as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
    await waitFor(() =>
      expect(apiMock.api).toHaveBeenCalledWith(expect.stringContaining('hasBalance=true')),
    );
  });
});
