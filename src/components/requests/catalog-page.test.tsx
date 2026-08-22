import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../messages/en';
import type { CatalogCategoryManage } from '@/lib/types';

/** Epic 15, Story 15.1 — catalog curation screen. */

const tenant = vi.hoisted(() => ({
  me: { user: { id: 'u1' }, hotel: { defaultLanguage: 'ar', timezone: 'Africa/Cairo' } },
  hasPermission: vi.fn(() => true),
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

import RequestCatalogPage from '../../app/t/[slug]/(dashboard)/requests/catalog/page';

const CATEGORY: CatalogCategoryManage = {
  id: 'cat-1',
  key: 'housekeeping',
  names: { ar: 'التدبير الفندقي', en: 'Housekeeping' },
  icon: 'sparkles',
  enabled: true,
  items: [
    {
      id: 'item-towels',
      key: 'extra_towels',
      names: { ar: 'مناشف إضافية', en: 'Extra towels' },
      descriptions: null,
      icon: 'layers',
      optionType: 'quantity',
      optionMin: 1,
      optionMax: 4,
      defaultSlaMinutes: 20,
      slaMinutes: 20,
      sortOrder: 0,
      enabled: true,
      isCustom: false,
    },
    {
      id: 'item-custom',
      key: null,
      names: { ar: 'منشفة مسبح', en: 'Pool towel' },
      descriptions: null,
      icon: 'star',
      optionType: null,
      optionMin: null,
      optionMax: null,
      defaultSlaMinutes: 25,
      slaMinutes: 25,
      sortOrder: 1,
      enabled: true,
      isCustom: true,
    },
  ],
};

function renderPage() {
  return render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Africa/Cairo">
      <RequestCatalogPage />
    </NextIntlClientProvider>,
  );
}

afterEach(cleanup);
beforeEach(() => {
  apiMock.api.mockReset();
  apiMock.api.mockImplementation(async () => ({ categories: [CATEGORY] }));
  tenant.hasPermission.mockReturnValue(true);
});

describe('RequestCatalogPage (15.1)', () => {
  it('permission gate: no request_catalog.manage → EmptyState, zero calls', () => {
    tenant.hasPermission.mockReturnValue(false);
    renderPage();
    expect(screen.getByText('No access to the catalog')).toBeTruthy();
    expect(apiMock.api).not.toHaveBeenCalled();
  });

  it('AC2/AC4 — items render; only custom items get the Custom badge and edit', async () => {
    renderPage();
    expect(await screen.findByText('Extra towels')).toBeTruthy();
    expect(screen.getByText('Pool towel')).toBeTruthy();
    expect(screen.getAllByText('Custom')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Edit Pool towel' })).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: 'Edit Extra towels' }),
    ).toBeNull();
  });

  it('AC2 — reorder sends the full new id order for the category', async () => {
    renderPage();
    await screen.findByText('Extra towels');
    const buttons = screen.getAllByRole('button', { name: 'Move down' });
    fireEvent.click(buttons[0]);
    const call = apiMock.api.mock.calls.find(([path]) =>
      String(path).includes('/reorder'),
    );
    expect(call).toBeTruthy();
    expect(JSON.parse(call![1].body as string)).toEqual({
      itemIds: ['item-custom', 'item-towels'],
    });
  });

  it('AC4 — the custom item modal requires AR + EN names before saving', async () => {
    renderPage();
    await screen.findByText('Extra towels');
    fireEvent.click(screen.getAllByRole('button', { name: /Add item/ })[0]);
    const dialog = screen.getByRole('dialog');
    const save = within(dialog).getByRole('button', {
      name: 'Create',
    }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.change(within(dialog).getByLabelText(/Name \(English\)/), {
      target: { value: 'Beach umbrella' },
    });
    expect(save.disabled).toBe(true);
    fireEvent.change(within(dialog).getByLabelText(/Name \(Arabic\)/), {
      target: { value: 'مظلة شاطئ' },
    });
    expect(save.disabled).toBe(false);
  });
});
