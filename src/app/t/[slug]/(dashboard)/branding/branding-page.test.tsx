import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../../../../messages/en';

/** Epic 18, Stories 18.1 + 18.3 — the guest-app branding management page. */

const tenant = vi.hoisted(() => ({
  me: {
    user: { id: 'u1' },
    hotel: { nameEn: 'Sunrise Resort', nameAr: 'منتجع الشروق', logoUrl: null },
  },
  hasPermission: vi.fn(() => true),
  isModuleEnabled: vi.fn(() => true),
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
  assetUrl: (p: string) => `http://api/${p}`,
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

import BrandingPage from './page';

const VIEW = {
  brandAccentColor: '#0F6B5C',
  coverThumbUrl: null,
  coverDetailUrl: null,
  welcomeMessage: { ar: 'أهلاً', en: 'Welcome' },
};

function renderPage() {
  return render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Africa/Cairo">
      <BrandingPage />
    </NextIntlClientProvider>,
  );
}

/**
 * The hex input. `exact: false` because Field renders its inline error inside
 * the same <label>, which extends the field's accessible name.
 */
function hexInput(): HTMLInputElement {
  return screen.getByLabelText(en.branding.accent.hex, {
    exact: false,
  }) as HTMLInputElement;
}

/** The Save button — the label lives inside <button>, not on it. */
function saveButton(): HTMLButtonElement {
  return screen.getByText(en.branding.save).closest('button')!;
}

function patchBody(): Record<string, unknown> {
  const call = apiMock.api.mock.calls.find(
    (c) => c[0] === '/tenant/branding' && c[1]?.method === 'PATCH',
  );
  return JSON.parse((call![1] as RequestInit).body as string);
}

beforeEach(() => {
  vi.clearAllMocks();
  tenant.hasPermission.mockReturnValue(true);
  tenant.isModuleEnabled.mockReturnValue(true);
  tenant.readOnly = false;
  apiMock.api.mockResolvedValue(VIEW);
});

describe('BrandingPage (18.1)', () => {
  it('AC1 — loads and renders the three knobs plus the preview', async () => {
    renderPage();
    await waitFor(() =>
      expect(apiMock.api).toHaveBeenCalledWith('/tenant/branding'),
    );
    expect(screen.getByTestId('phone-preview')).toBeTruthy();
    expect(screen.getByText(en.branding.accent.label)).toBeTruthy();
    expect(screen.getAllByText(en.branding.cover.label).length).toBeGreaterThan(
      0,
    );
    expect(screen.getByText(en.branding.welcome.title)).toBeTruthy();
    // welcome message loads into the editable fields and the preview
    expect(screen.getByDisplayValue('Welcome')).toBeTruthy();
    expect(screen.getByTestId('preview-welcome').textContent).toBe('Welcome');
  });

  it('AC1 — a malformed hex explains itself and keeps save disabled', async () => {
    renderPage();
    await waitFor(() => expect(apiMock.api).toHaveBeenCalled());
    fireEvent.change(hexInput(), {
      target: { value: '#0F6' },
    });
    expect(screen.getByText(en.branding.accent.invalidHex)).toBeTruthy();
    expect(saveButton().hasAttribute('disabled')).toBe(true);
    // ...and clears once the value is a real hex
    fireEvent.change(hexInput(), {
      target: { value: '#0F6B5C' },
    });
    expect(screen.queryByText(en.branding.accent.invalidHex)).toBeNull();
    expect(saveButton().hasAttribute('disabled')).toBe(false);
  });

  it('AC1 — hex entry is normalized to uppercase', async () => {
    renderPage();
    await waitFor(() => expect(apiMock.api).toHaveBeenCalled());
    fireEvent.change(hexInput(), {
      target: { value: '#b3402a' },
    });
    expect(hexInput().value).toBe('#B3402A');
  });

  it('AC1 — blocks an unreadable accent with explanation + suggestion; save disabled', async () => {
    renderPage();
    await waitFor(() => expect(apiMock.api).toHaveBeenCalled());
    fireEvent.change(hexInput(), {
      target: { value: '#FFA500' },
    });
    expect(screen.getByText(en.branding.accent.blocked)).toBeTruthy();
    expect(screen.getByTestId('accent-suggestion')).toBeTruthy();
    expect(saveButton().hasAttribute('disabled')).toBe(true);
  });

  it('AC1 — the suggestion button applies a passing shade and unblocks save', async () => {
    renderPage();
    await waitFor(() => expect(apiMock.api).toHaveBeenCalled());
    fireEvent.change(hexInput(), {
      target: { value: '#FFA500' },
    });
    fireEvent.click(screen.getByTestId('accent-suggestion'));
    expect(screen.queryByText(en.branding.accent.blocked)).toBeNull();
    expect(saveButton().hasAttribute('disabled')).toBe(false);
  });

  it('AC3 — save PATCHes accent + all welcome fields', async () => {
    renderPage();
    await waitFor(() => expect(apiMock.api).toHaveBeenCalled());
    fireEvent.change(hexInput(), {
      target: { value: '#B3402A' },
    });
    fireEvent.click(saveButton());
    await waitFor(() =>
      expect(apiMock.api).toHaveBeenCalledWith(
        '/tenant/branding',
        expect.objectContaining({ method: 'PATCH' }),
      ),
    );
    const body = patchBody();
    expect(body.brandAccentColor).toBe('#B3402A');
    expect(body.welcomeEn).toBe('Welcome');
    expect(body.welcomeAr).toBe('أهلاً');
  });

  it('AC3 — global reset confirms with ConsequenceNote then clears everything', async () => {
    apiMock.api.mockResolvedValue({
      ...VIEW,
      coverThumbUrl: 'files/branding/h1/x-thumb.webp',
      coverDetailUrl: 'files/branding/h1/x-detail.webp',
    });
    renderPage();
    await waitFor(() => expect(apiMock.api).toHaveBeenCalled());
    fireEvent.click(screen.getByText(en.branding.reset.all));
    expect(screen.getByText(en.branding.reset.confirmTitle)).toBeTruthy();
    expect(screen.getByText(en.branding.reset.consequence)).toBeTruthy();

    apiMock.api.mockResolvedValue(VIEW);
    fireEvent.click(
      screen
        .getAllByText(en.branding.reset.all)
        .map((el) => el.closest('button')!)
        .at(-1)!,
    );
    await waitFor(() => {
      const body = patchBody();
      expect(body.brandAccentColor).toBe('');
      expect(body.welcomeEn).toBe('');
      expect(body.welcomeAr).toBe('');
    });
    // the stored cover is deleted too
    await waitFor(() =>
      expect(apiMock.api).toHaveBeenCalledWith(
        '/tenant/branding/cover',
        expect.objectContaining({ method: 'DELETE' }),
      ),
    );
  });

  it('AC3 — the welcome knob resets on its own, leaving the accent untouched', async () => {
    renderPage();
    await waitFor(() => expect(apiMock.api).toHaveBeenCalled());
    fireEvent.click(
      screen.getByText(en.branding.welcome.reset).closest('button')!,
    );
    expect(screen.queryByDisplayValue('Welcome')).toBeNull();
    expect(screen.queryByTestId('preview-welcome')).toBeNull();
    fireEvent.click(saveButton());
    await waitFor(() => {
      const body = patchBody();
      expect(body.welcomeEn).toBe('');
      expect(body.welcomeAr).toBe('');
      expect(body.brandAccentColor).toBe('#0F6B5C');
    });
  });

  it('AC4 — links to the profile for the logo instead of duplicating an upload', async () => {
    renderPage();
    await waitFor(() => expect(apiMock.api).toHaveBeenCalled());
    expect(screen.getByText(en.branding.logoNote.text)).toBeTruthy();
    const link = screen.getByText(en.branding.logoNote.link).closest('a')!;
    expect(link.getAttribute('href')).toBe('/t/sunrise/profile');
  });

  it('AC2 — the preview follows the language toggle', async () => {
    renderPage();
    await waitFor(() => expect(apiMock.api).toHaveBeenCalled());
    expect(screen.getByTestId('preview-welcome').textContent).toBe('Welcome');
    fireEvent.click(
      screen.getByText(en.branding.preview.arabic).closest('button')!,
    );
    expect(screen.getByTestId('preview-welcome').textContent).toBe('أهلاً');
    expect(screen.getByTestId('phone-preview').getAttribute('dir')).toBe('rtl');
  });

  it('readOnly disables the save button', async () => {
    tenant.readOnly = true;
    renderPage();
    await waitFor(() => expect(apiMock.api).toHaveBeenCalled());
    expect(saveButton().hasAttribute('disabled')).toBe(true);
  });

  it('a failed load shows the error state with retry', async () => {
    apiMock.api.mockRejectedValueOnce(new Error('boom'));
    renderPage();
    expect(await screen.findByText(en.common.actions.retry)).toBeTruthy();
    apiMock.api.mockResolvedValue(VIEW);
    fireEvent.click(screen.getByText(en.common.actions.retry));
    expect(await screen.findByDisplayValue('Welcome')).toBeTruthy();
  });
});

describe('BrandingPage — permission gate', () => {
  it('no branding.manage → designed gate screen, no fetch', () => {
    tenant.hasPermission.mockReturnValue(false);
    renderPage();
    expect(tenant.hasPermission).toHaveBeenCalledWith('branding.manage');
    expect(screen.getByText(en.branding.noPermission.title)).toBeTruthy();
    expect(screen.getByText(en.branding.noPermission.hint)).toBeTruthy();
    expect(apiMock.api).not.toHaveBeenCalled();
  });

  it('the permission gate wins over the module upsell', () => {
    tenant.hasPermission.mockReturnValue(false);
    tenant.isModuleEnabled.mockReturnValue(false);
    renderPage();
    expect(screen.getByText(en.branding.noPermission.title)).toBeTruthy();
    expect(screen.queryByTestId('module-upsell-guest_app_branding')).toBeNull();
  });
});

describe('BrandingPage — locked state (18.3)', () => {
  beforeEach(() => tenant.isModuleEnabled.mockReturnValue(false));

  it('AC1/AC2 — module off: upsell shell, demo preview, no API call', () => {
    renderPage();
    expect(
      screen.getByTestId('module-upsell-guest_app_branding'),
    ).toBeTruthy();
    expect(screen.getByTestId('phone-preview')).toBeTruthy();
    expect(screen.getByText(en.shell.moduleLocked.hint)).toBeTruthy();
    expect(screen.getByTestId('preview-welcome').textContent).toBe(
      'Welcome to the heart of Hurghada',
    );
    expect(apiMock.api).not.toHaveBeenCalled();
  });

  it('AC1 — all three knobs are present and inert, over a stock demo cover', () => {
    renderPage();
    // every knob is visible…
    expect(screen.getByText(en.branding.accent.label)).toBeTruthy();
    expect(screen.getAllByText(en.branding.cover.label).length).toBeGreaterThan(
      0,
    );
    expect(screen.getByText(en.branding.welcome.title)).toBeTruthy();
    // …filled with the sample branding…
    const hex = hexInput();
    expect(hex.value).toBe('#0F6B5C');
    expect(screen.getByDisplayValue('Welcome to the heart of Hurghada'))
      .toBeTruthy();
    // …and locked: no focusable control escapes the inert wrapper.
    expect(hex.disabled).toBe(true);
    expect(
      (
        screen.getByLabelText(en.branding.accent.label) as HTMLInputElement
      ).disabled,
    ).toBe(true);
    expect(
      screen.getByText(en.branding.cover.upload).closest('button')!.disabled,
    ).toBe(true);
    // the stock cover is a gradient, not an uploaded asset
    expect(screen.getByTestId('preview-demo-cover')).toBeTruthy();
    // no save/reset affordances at all — nothing to save
    expect(screen.queryByText(en.branding.save)).toBeNull();
    expect(screen.queryByText(en.branding.reset.all)).toBeNull();
  });
});
