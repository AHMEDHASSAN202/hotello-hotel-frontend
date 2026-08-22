import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import en from '../../../../../../../messages/en';

/** Epic 16, Story 16.3 — delivery locations + QR stickers. */

const tenant = vi.hoisted(() => ({
  me: { user: { id: 'u1' }, hotel: {} },
  hasPermission: vi.fn(() => true),
  readOnly: false,
  isHintDismissed: vi.fn(() => false),
  dismissHint: vi.fn(),
  undismissHint: vi.fn(),
}));

vi.mock('@/components/tenant-provider', () => ({ useTenant: () => tenant }));
vi.mock('next/navigation', () => ({ useParams: () => ({ slug: 'sunrise' }) }));

const apiMock = vi.hoisted(() => ({
  api: vi.fn(),
  apiBlob: vi.fn(),
  saveBlob: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  api: apiMock.api,
  apiBlob: apiMock.apiBlob,
  saveBlob: apiMock.saveBlob,
  guestUrlForSlug: (slug: string) => `https://guest.example/${slug}`,
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

import FnbLocationsPage from './page';

const POOL = {
  id: 'loc-1',
  key: 'pool',
  names: { en: 'Pool', ar: 'المسبح' },
  hasSpots: true,
  spotLabel: { en: 'Umbrella', ar: 'شمسية' },
  isActive: true,
  sortOrder: 0,
};

function renderPage() {
  return render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Africa/Cairo">
      <FnbLocationsPage />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  tenant.hasPermission.mockReset();
  tenant.hasPermission.mockReturnValue(true);
  tenant.readOnly = false;
  apiMock.api.mockReset();
  apiMock.apiBlob.mockReset();
  apiMock.saveBlob.mockReset();
  apiMock.api.mockResolvedValue({ locations: [POOL] });
  apiMock.apiBlob.mockResolvedValue({
    blob: new Blob(['png']),
    filename: null,
  });
  // jsdom lacks these; the QR preview uses object URLs.
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:qr');
  globalThis.URL.revokeObjectURL = vi.fn();
});

describe('FnbLocationsPage (16.3)', () => {
  it('AC3 — the zone-vs-numbered guidance is visible in product', async () => {
    renderPage();
    await screen.findByText('Pool');
    expect(
      screen.getByText(/numbered series only for fixed furniture/),
    ).toBeTruthy();
  });

  it('AC1 — rows show name, immutable key and the spot label', async () => {
    renderPage();
    const row = (await screen.findByText('Pool')).closest('li') as HTMLElement;
    expect(row.textContent).toContain('pool');
    expect(row.textContent).toContain('Numbered spots: Umbrella');
  });

  it('AC4 — the edit modal shows the key as locked with no input for it', async () => {
    renderPage();
    await screen.findByText('Pool');
    fireEvent.click(screen.getByRole('button', { name: /Edit: Pool/ }));
    expect(await screen.findByText('QR key')).toBeTruthy();
    expect(
      screen.getByText(/Locked once created — printed stickers depend on it/),
    ).toBeTruthy();
    // Display names only — no editable key field exists.
    expect(screen.queryByLabelText(/QR key/)).toBeNull();
  });

  it('AC2 — the QR modal offers the numbered series and requests the range', async () => {
    renderPage();
    await screen.findByText('Pool');
    fireEvent.click(screen.getByRole('button', { name: /QR & stickers/ }));

    expect(await screen.findByText('Guest link')).toBeTruthy();
    expect(screen.getByText(/guest\.example\/sunrise\?location=pool/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Numbered series' }));
    fireEvent.change(screen.getByLabelText(/From/), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText(/^To/), { target: { value: '40' } });
    fireEvent.click(
      screen.getByRole('button', { name: 'Download stickers PDF' }),
    );

    await waitFor(() => {
      const call = apiMock.apiBlob.mock.calls.find(([path]) =>
        String(path).includes('/pdf/stickers'),
      );
      expect(String(call![0])).toContain('from=1');
      expect(String(call![0])).toContain('to=40');
    });
    expect(apiMock.saveBlob).toHaveBeenCalled();
  });
});
