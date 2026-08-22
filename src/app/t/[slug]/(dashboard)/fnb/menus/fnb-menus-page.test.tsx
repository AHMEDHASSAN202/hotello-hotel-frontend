import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import en from '../../../../../../../messages/en';

/** Epic 16, Story 16.2 — the menus builder. */

const tenant = vi.hoisted(() => ({
  me: { user: { id: 'u1' }, hotel: { currency: 'EGP' } },
  hasPermission: vi.fn(() => true),
  readOnly: false,
  isHintDismissed: vi.fn(() => true),
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

import FnbMenusPage from './page';

const TREE = {
  menus: [
    {
      id: 'menu-1',
      names: { en: 'Pool Bar', ar: 'بار المسبح' },
      descriptions: null,
      windows: [{ start: '10:00', end: '18:00' }],
      defaultIncludedFor: ['all_inclusive'],
      prepSlaMinutes: 20,
      isActive: true,
      sortOrder: 0,
      sections: [
        {
          id: 'section-1',
          menuId: 'menu-1',
          names: { en: 'Drinks', ar: 'مشروبات' },
          isActive: true,
          sortOrder: 0,
          items: [
            {
              id: 'item-1',
              sectionId: 'section-1',
              names: { en: 'Fresh Juice', ar: 'عصير' },
              descriptions: null,
              photoThumbUrl: null,
              photoDetailUrl: null,
              price: 40,
              includedFor: null, // inherits → included for AI
              variant: null,
              allowNotes: true,
              isActive: true,
              sortOrder: 0,
            },
            {
              id: 'item-2',
              sectionId: 'section-1',
              names: { en: 'Imported Whiskey', ar: 'ويسكي' },
              descriptions: null,
              photoThumbUrl: null,
              photoDetailUrl: null,
              price: 250,
              includedFor: [], // always-paid override
              variant: null,
              allowNotes: true,
              isActive: true,
              sortOrder: 1,
            },
          ],
        },
      ],
    },
  ],
};

function renderPage() {
  return render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Africa/Cairo">
      <FnbMenusPage />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  tenant.hasPermission.mockReset();
  tenant.hasPermission.mockReturnValue(true);
  tenant.readOnly = false;
  apiMock.api.mockReset();
  apiMock.api.mockResolvedValue(TREE);
});

describe('FnbMenusPage (16.2)', () => {
  it('without fnb_menus.manage renders the noAccess state, no API calls', async () => {
    tenant.hasPermission.mockReturnValue(false);
    renderPage();
    expect(
      await screen.findByText("You don't have access to F&B orders"),
    ).toBeTruthy();
    expect(apiMock.api).not.toHaveBeenCalled();
  });

  it('AC3 — inherited items show ✓ Included; the always-paid override shows its price', async () => {
    renderPage();
    await screen.findByText('Pool Bar');
    const juiceRow = screen.getByText('Fresh Juice').closest('li') as HTMLElement;
    expect(juiceRow.textContent).toContain('✓ Included');
    const whiskeyRow = screen
      .getByText('Imported Whiskey')
      .closest('li') as HTMLElement;
    expect(whiskeyRow.textContent).toMatch(/250/);
    expect(whiskeyRow.textContent).not.toContain('✓ Included');
  });

  it('AC1 — the menu card shows windows, prep target and the pricing default', async () => {
    renderPage();
    const card = (await screen.findByText('Pool Bar')).closest(
      'section',
    ) as HTMLElement;
    expect(card.textContent).toContain('10:00–18:00');
    expect(card.textContent).toContain('Prep target: 20 min');
    expect(card.textContent).toContain('Included by default for: All-Inclusive');
  });

  it('AC4 — the item modal serializes a variant group with per-option prices', async () => {
    renderPage();
    await screen.findByText('Pool Bar');
    fireEvent.click(screen.getByRole('button', { name: 'Add item' }));

    fireEvent.change(screen.getByLabelText(/Name \(English\)/), {
      target: { value: 'Lemonade' },
    });
    fireEvent.change(screen.getByLabelText(/Name \(Arabic\)/), {
      target: { value: 'ليمونادة' },
    });
    fireEvent.change(screen.getByLabelText(/^Price/), {
      target: { value: '40' },
    });
    fireEvent.click(screen.getByLabelText(/This item has options/));
    fireEvent.change(screen.getByLabelText(/Group label \(English\)/), {
      target: { value: 'Size' },
    });
    fireEvent.change(screen.getByLabelText(/Group label \(Arabic\)/), {
      target: { value: 'الحجم' },
    });
    fireEvent.change(screen.getByLabelText(/Option \(English\)/), {
      target: { value: 'Large' },
    });
    fireEvent.change(screen.getByLabelText(/Option \(Arabic\)/), {
      target: { value: 'كبير' },
    });
    const priceInputs = screen.getAllByLabelText(/^Price/);
    fireEvent.change(priceInputs[priceInputs.length - 1], {
      target: { value: '55' },
    });

    apiMock.api.mockResolvedValueOnce({ id: 'item-new', photoThumbUrl: null });
    fireEvent.click(screen.getByRole('button', { name: 'Create item' }));

    await waitFor(() => {
      const post = apiMock.api.mock.calls.find(
        ([path, init]) =>
          String(path).includes('/sections/section-1/items') &&
          (init as RequestInit | undefined)?.method === 'POST',
      );
      expect(post).toBeTruthy();
      const body = JSON.parse(String((post![1] as RequestInit).body));
      expect(body).toMatchObject({
        nameEn: 'Lemonade',
        nameAr: 'ليمونادة',
        price: 40,
        includedFor: null, // inherit is the default mode
        variant: {
          nameEn: 'Size',
          nameAr: 'الحجم',
          options: [{ nameEn: 'Large', nameAr: 'كبير', price: 55 }],
        },
        allowNotes: true,
      });
    });
  });

  it('readOnly disables the add-menu button', async () => {
    tenant.readOnly = true;
    renderPage();
    await screen.findByText('Pool Bar');
    const button = screen.getAllByRole('button', { name: /New menu/ })[0];
    expect(button.hasAttribute('disabled')).toBe(true);
  });
});
