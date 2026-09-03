import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import en from '../../../messages/en';

/**
 * Epic 13, Story 13.2 — the stays board. Same harness as rooms-page.test.tsx:
 * mocked tenant context + api, real English messages, no jest-dom matchers.
 */

const tenant = vi.hoisted(() => ({
  me: { user: { id: 'u1' }, hotel: { defaultLanguage: 'ar', currency: 'EGP' } },
  hasPermission: vi.fn(() => true),
  isModuleEnabled: vi.fn(() => false),
  readOnly: false,
  isHintDismissed: vi.fn(() => true),
  dismissHint: vi.fn(),
  undismissHint: vi.fn(),
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
}));

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

import StaysPage from '../../app/t/[slug]/(dashboard)/stays/page';

const STAY = {
  id: 's1',
  roomId: 'r1',
  roomNumber: '101',
  floor: 1,
  guestName: 'Ahmed Ali',
  email: null,
  phone: null,
  language: 'ar',
  guestsCount: null,
  note: null,
  stayType: 'all_inclusive',
  checkInDate: '2026-08-20',
  checkOutDate: '2026-08-23',
  nightsRemaining: 3,
  status: 'active',
  checkoutType: null,
  checkedOutAt: null,
  createdAt: '2026-08-20T10:00:00Z',
};

function mockApi(handlers: Record<string, unknown> = {}) {
  apiMock.api.mockImplementation(async (path: string) => {
    if (path.startsWith('/tenant/stays/settings'))
      return { checkoutTime: '12:00', defaultStayType: 'room_only' };
    if (path.startsWith('/tenant/stays/available-rooms')) return [];
    for (const [prefix, value] of Object.entries(handlers)) {
      if (path.includes(prefix)) return value;
    }
    return { data: [], total: 0 };
  });
}

function renderPage() {
  return render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Africa/Cairo">
      <StaysPage />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  tenant.hasPermission.mockReset();
  tenant.hasPermission.mockReturnValue(true);
  tenant.readOnly = false;
  nav.hasBalance = null;
  apiMock.api.mockReset();
});

describe('StaysPage (13.2)', () => {
  it('without stays.read renders the noAccess EmptyState and calls no API', async () => {
    tenant.hasPermission.mockReturnValue(false);
    renderPage();

    expect(
      await screen.findByText("You don't have access to stays"),
    ).toBeTruthy();
    expect(apiMock.api).not.toHaveBeenCalled();
  });

  it('AC1 — the active board shows room, guest, dates, nights and status with InfoTip', async () => {
    mockApi({ 'view=active': { data: [STAY], total: 1 } });
    renderPage();

    await screen.findByText('Ahmed Ali');
    const row = screen.getByText('Ahmed Ali').closest('tr') as HTMLElement;
    expect(within(row).getByText('101')).toBeTruthy();
    expect(within(row).getByText('3 nights')).toBeTruthy();
    expect(within(row).getByText('Arabic')).toBeTruthy();

    // 12.3 AC1 — the status badge explains itself.
    fireEvent.click(within(row).getByRole('button', { name: 'Active' }));
    expect(
      screen.getByText(
        'The guest is currently checked in and their stay code opens the guest app.',
      ),
    ).toBeTruthy();
  });

  it('AC2 — switching to History requests view=history and shows checkout type', async () => {
    mockApi({
      'view=active': { data: [STAY], total: 1 },
      'view=history': {
        data: [
          {
            ...STAY,
            id: 's2',
            status: 'checked_out',
            checkoutType: 'automatic',
            nightsRemaining: null,
            checkedOutAt: '2026-08-19T10:00:00Z',
          },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
      },
    });
    renderPage();
    await screen.findByText('Ahmed Ali');

    fireEvent.click(screen.getByRole('button', { name: 'History' }));

    expect(await screen.findByText('Automatic')).toBeTruthy();
    const historyCall = apiMock.api.mock.calls.find(([path]) =>
      String(path).includes('view=history'),
    );
    expect(historyCall).toBeTruthy();
    expect(String(historyCall![0])).toContain('page=1');
  });

  it('empty board vs filtered-to-zero are two distinct screens (12.3 AC3)', async () => {
    mockApi({ 'view=active': { data: [], total: 0 } });
    renderPage();

    expect(
      await screen.findByText('No guests are checked in right now'),
    ).toBeTruthy();

    const searchInput = screen.getByLabelText('Search stays');
    fireEvent.change(searchInput, { target: { value: 'ghost' } });
    fireEvent.submit(searchInput.closest('form') as HTMLFormElement);

    expect(
      await screen.findByText('No stays match these filters'),
    ).toBeTruthy();
    expect(
      screen.queryByText('No guests are checked in right now'),
    ).toBeNull();
    expect(
      screen.getAllByRole('button', { name: 'Clear filters' }).length,
    ).toBeGreaterThanOrEqual(1);
  });

  it('readOnly disables the check-in button', async () => {
    tenant.readOnly = true;
    mockApi({ 'view=active': { data: [STAY], total: 1 } });
    renderPage();
    await screen.findByText('Ahmed Ali');

    const button = screen.getAllByRole('button', { name: 'Check in guest' })[0];
    expect(button.hasAttribute('disabled')).toBe(true);
  });

  it('the settings card loads and saves the checkout hour (13.4 AC2)', async () => {
    mockApi({ 'view=active': { data: [], total: 0 } });
    renderPage();

    const timeInput = (await screen.findByLabelText(
      /Checkout time/,
    )) as HTMLInputElement;
    await waitFor(() => expect(timeInput.value).toBe('12:00'));

    fireEvent.change(timeInput, { target: { value: '14:00' } });
    apiMock.api.mockResolvedValueOnce({ checkoutTime: '14:00', defaultStayType: 'room_only' });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Stay settings saved.')).toBeTruthy();
    const patchCall = apiMock.api.mock.calls.find(
      ([, init]) => (init as RequestInit | undefined)?.method === 'PATCH',
    );
    expect(patchCall).toBeTruthy();
    expect(String(patchCall![0])).toBe('/tenant/stays/settings');
  });

  it('16.1 AC2 — the settings card saves the default stay type with the hour', async () => {
    mockApi({ 'view=active': { data: [], total: 0 } });
    renderPage();

    const select = (await screen.findByLabelText(
      /Default stay type/,
    )) as HTMLSelectElement;
    await waitFor(() => expect(select.value).toBe('room_only'));

    fireEvent.change(select, { target: { value: 'all_inclusive' } });
    apiMock.api.mockResolvedValueOnce({
      checkoutTime: '12:00',
      defaultStayType: 'all_inclusive',
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Stay settings saved.')).toBeTruthy();
    const patchCall = apiMock.api.mock.calls.find(
      ([, init]) => (init as RequestInit | undefined)?.method === 'PATCH',
    );
    expect(JSON.parse((patchCall![1] as RequestInit).body as string)).toEqual({
      checkoutTime: '12:00',
      defaultStayType: 'all_inclusive',
    });
  });

  it('22.4 AC4 — checking "Has balance" adds hasBalance=1 to the stays request', async () => {
    mockApi({ 'view=active': { data: [], total: 0 } });
    renderPage();
    await screen.findByText('No guests are checked in right now');
    apiMock.api.mockClear();
    mockApi({ 'view=active': { data: [], total: 0 } });

    fireEvent.click(screen.getByLabelText('Has balance'));

    await waitFor(() =>
      expect(apiMock.api).toHaveBeenCalledWith(expect.stringContaining('hasBalance=1')),
    );
  });

  it('22.4 AC4 — the hasBalance filter also applies on the History tab', async () => {
    mockApi({ 'view=active': { data: [STAY], total: 1 } });
    renderPage();
    await screen.findByText('Ahmed Ali');

    fireEvent.click(screen.getByLabelText('Has balance'));
    fireEvent.click(screen.getByRole('button', { name: 'History' }));

    await waitFor(() =>
      expect(apiMock.api).toHaveBeenCalledWith(
        expect.stringMatching(/view=history.*hasBalance=1|hasBalance=1.*view=history/),
      ),
    );
  });

  it('22.4 AC4 — a danger balance badge renders only when unsettledTotal is present AND > 0', async () => {
    mockApi({
      'view=active': {
        data: [
          { ...STAY, id: 's1', unsettledTotal: 250 },
          { ...STAY, id: 's2', roomNumber: '102', guestName: 'Mona Said', unsettledTotal: 0 },
          { ...STAY, id: 's3', roomNumber: '103', guestName: 'Sara Adel' },
        ],
        total: 3,
      },
    });
    renderPage();

    await screen.findByText('Ahmed Ali');
    expect(screen.getAllByText('EGP 250.00').length).toBe(1);
  });

  it('22.4 AC4 — seeds the hasBalance filter checkbox from ?hasBalance=1 in the URL', async () => {
    nav.hasBalance = '1';
    mockApi({ 'view=active': { data: [], total: 0 } });
    renderPage();

    const checkbox = (await screen.findByLabelText('Has balance')) as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
    await waitFor(() =>
      expect(apiMock.api).toHaveBeenCalledWith(expect.stringContaining('hasBalance=1')),
    );
  });
});
