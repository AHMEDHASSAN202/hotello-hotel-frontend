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

  it('AC1 — blocks an unreadable accent with explanation + suggestion; save disabled', async () => {
    renderPage();
    await waitFor(() => expect(apiMock.api).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText(en.branding.accent.hex), {
      target: { value: '#FFA500' },
    });
    expect(screen.getByText(en.branding.accent.blocked)).toBeTruthy();
    expect(screen.getByTestId('accent-suggestion')).toBeTruthy();
    expect(saveButton().hasAttribute('disabled')).toBe(true);
  });

  it('AC1 — the suggestion button applies a passing shade and unblocks save', async () => {
    renderPage();
    await waitFor(() => expect(apiMock.api).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText(en.branding.accent.hex), {
      target: { value: '#FFA500' },
    });
    fireEvent.click(screen.getByTestId('accent-suggestion'));
    expect(screen.queryByText(en.branding.accent.blocked)).toBeNull();
    expect(saveButton().hasAttribute('disabled')).toBe(false);
  });

  it('AC3 — save PATCHes accent + all welcome fields', async () => {
    renderPage();
    await waitFor(() => expect(apiMock.api).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText(en.branding.accent.hex), {
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

describe('BrandingPage — locked state (18.3)', () => {
  it('AC1/AC2 — module off: upsell shell, demo preview, no API call', () => {
    tenant.isModuleEnabled.mockReturnValue(false);
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
});
