import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import en from '../../../../../../messages/en';

/** Epic 17, Story 17.1 — the hotel info management page. */

const tenant = vi.hoisted(() => ({
  me: { user: { id: 'u1' }, hotel: { currency: 'EGP' } },
  hasPermission: vi.fn(() => true),
  readOnly: false,
  isHintDismissed: vi.fn(() => false),
  dismissHint: vi.fn(),
  undismissHint: vi.fn(),
}));

vi.mock('@/components/tenant-provider', () => ({ useTenant: () => tenant }));
vi.mock('next/navigation', () => ({ useParams: () => ({ slug: 'sunrise' }) }));

const apiMock = vi.hoisted(() => ({ api: vi.fn(), apiUpload: vi.fn() }));

vi.mock('@/lib/api', () => ({
  api: apiMock.api,
  apiUpload: apiMock.apiUpload,
  assetUrl: (p: string | null) => (p ? `http://api/${p}` : null),
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

import HotelInfoPage from './page';

const OVERVIEW = {
  checkoutTime: '11:30',
  essentials: {
    id: 'ess-1',
    section: 'essentials',
    names: {},
    descriptions: null,
    structured: { wifiName: 'Lobby WiFi', wifiPassword: 'sunrise2026' },
    photos: [],
    sortOrder: 0,
    isActive: true,
  },
  facilities: [
    {
      id: 'fac-1',
      section: 'facilities',
      names: { en: 'Pool', ar: 'المسبح' },
      descriptions: null,
      structured: { windows: [{ start: '08:00', end: '20:00' }] },
      photos: [],
      sortOrder: 0,
      isActive: true,
    },
    {
      id: 'fac-2',
      section: 'facilities',
      names: { en: 'Gym', ar: 'الصالة' },
      descriptions: null,
      structured: {},
      photos: [],
      sortOrder: 1,
      isActive: false,
    },
  ],
  services: [],
  houseRules: [],
  about: null,
};

function renderPage() {
  return render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Africa/Cairo">
      <HotelInfoPage />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  tenant.hasPermission.mockReturnValue(true);
  tenant.readOnly = false;
  apiMock.api.mockResolvedValue(OVERVIEW);
});

describe('HotelInfoPage (17.1)', () => {
  it('AC1 — renders all five sections with checkout time projected read-only', async () => {
    renderPage();
    expect(await screen.findByText('Pool')).toBeTruthy();
    expect(screen.getByText(en.hotelInfo.essentials.title)).toBeTruthy();
    expect(screen.getByText(en.hotelInfo.sections.services.title)).toBeTruthy();
    expect(
      screen.getByText(en.hotelInfo.sections.house_rules.title),
    ).toBeTruthy();
    expect(screen.getByText(en.hotelInfo.about.title)).toBeTruthy();
    // checkout is text, not an input
    expect(screen.getByText('11:30').tagName).toBe('P');
    expect(screen.getByDisplayValue('Lobby WiFi')).toBeTruthy();
  });

  it('AC1 — saving essentials PUTs the full card', async () => {
    renderPage();
    await screen.findByText('Pool');
    fireEvent.change(screen.getByDisplayValue('sunrise2026'), {
      target: { value: 'newpass' },
    });
    fireEvent.click(screen.getByText(en.hotelInfo.essentials.save));
    await waitFor(() => {
      const call = apiMock.api.mock.calls.find(
        (c) => c[0] === '/tenant/hotel-info/essentials',
      );
      expect(call).toBeTruthy();
      expect(JSON.parse(call![1].body as string)).toMatchObject({
        wifiName: 'Lobby WiFi',
        wifiPassword: 'newpass',
      });
    });
  });

  it('AC2 — the entry modal blocks save without an Arabic name', async () => {
    renderPage();
    await screen.findByText('Pool');
    // header button + empty-state CTA both carry the label — either works
    fireEvent.click(screen.getAllByText(en.hotelInfo.sections.services.add)[0]);
    const save = screen
      .getAllByText(en.hotelInfo.entryModal.save)
      .find((el) => (el.closest('button') ?? el).tagName) as HTMLElement;
    const saveButton = save.closest('button')!;
    expect(saveButton.hasAttribute('disabled')).toBe(true);
    fireEvent.change(screen.getByLabelText(/Name \(English\)/), {
      target: { value: 'Laundry' },
    });
    expect(saveButton.hasAttribute('disabled')).toBe(true);
    fireEvent.change(screen.getByLabelText(/Name \(Arabic\)/), {
      target: { value: 'غسيل' },
    });
    expect(saveButton.hasAttribute('disabled')).toBe(false);
  });

  it('AC3 — reorder POSTs the swapped full id array', async () => {
    renderPage();
    await screen.findByText('Pool');
    fireEvent.click(screen.getAllByLabelText(en.hotelInfo.row.moveDown)[0]);
    await waitFor(() => {
      const call = apiMock.api.mock.calls.find(
        (c) => c[0] === '/tenant/hotel-info/sections/facilities/reorder',
      );
      expect(call).toBeTruthy();
      expect(JSON.parse(call![1].body as string)).toEqual({
        entryIds: ['fac-2', 'fac-1'],
      });
    });
  });

  it('AC3 — the active toggle PATCHes isActive and inactive rows are badged', async () => {
    renderPage();
    await screen.findByText('Pool');
    expect(screen.getByText(en.hotelInfo.row.inactive)).toBeTruthy();
    fireEvent.click(screen.getAllByText(en.hotelInfo.row.deactivate)[0]);
    await waitFor(() => {
      const call = apiMock.api.mock.calls.find(
        (c) => c[0] === '/tenant/hotel-info/entries/fac-1',
      );
      expect(call).toBeTruthy();
      expect(JSON.parse(call![1].body as string)).toEqual({ isActive: false });
    });
  });

  it('AC4 — the guidance HintCard shows until dismissed', async () => {
    renderPage();
    await screen.findByText('Pool');
    expect(screen.getByText(en.guidance.hotelInfo.hint.title)).toBeTruthy();
    tenant.isHintDismissed.mockReturnValue(true);
    renderPage();
    expect(
      screen.getAllByText(en.guidance.hotelInfo.hint.title),
    ).toHaveLength(1); // only the first render's copy remains
  });

  it('readOnly disables the mutating controls', async () => {
    tenant.readOnly = true;
    renderPage();
    await screen.findByText('Pool');
    const save = screen
      .getByText(en.hotelInfo.essentials.save)
      .closest('button')!;
    expect(save.hasAttribute('disabled')).toBe(true);
    const add = screen
      .getByText(en.hotelInfo.sections.facilities.add)
      .closest('button')!;
    expect(add.hasAttribute('disabled')).toBe(true);
  });

  it('no permission → gate screen, no fetch', () => {
    tenant.hasPermission.mockReturnValue(false);
    renderPage();
    expect(screen.getByText(en.hotelInfo.noPermission.title)).toBeTruthy();
    expect(apiMock.api).not.toHaveBeenCalled();
  });
});
