import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import en from '../../../../../../../messages/en';

/** Epic 16, Story 16.4 — payment-methods settings. */

const tenant = vi.hoisted(() => ({
  me: { user: { id: 'u1' }, hotel: {} },
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

import FnbSettingsPage from './page';

function renderPage() {
  return render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Africa/Cairo">
      <FnbSettingsPage />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  tenant.hasPermission.mockReset();
  tenant.hasPermission.mockReturnValue(true);
  tenant.readOnly = false;
  apiMock.api.mockReset();
  apiMock.api.mockResolvedValue({ cashEnabled: true, roomChargeEnabled: false });
});

describe('FnbSettingsPage (16.4)', () => {
  it('AC1 — cash is always on (locked); room charge is the single opt-in', async () => {
    renderPage();
    const cash = (await screen.findByLabelText(
      /Cash on delivery/,
    )) as HTMLInputElement;
    expect(cash.checked).toBe(true);
    expect(cash.disabled).toBe(true);

    const roomCharge = screen.getByLabelText(
      /Room charge \(pay at checkout\)/,
    ) as HTMLInputElement;
    expect(roomCharge.checked).toBe(false);
    expect(roomCharge.disabled).toBe(false);
  });

  it('AC1 — enabling room charge PATCHes the settings', async () => {
    renderPage();
    const roomCharge = (await screen.findByLabelText(
      /Room charge \(pay at checkout\)/,
    )) as HTMLInputElement;
    fireEvent.click(roomCharge);
    apiMock.api.mockResolvedValueOnce({ cashEnabled: true, roomChargeEnabled: true });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Payment methods saved.')).toBeTruthy();
    await waitFor(() => {
      const patch = apiMock.api.mock.calls.find(
        ([, init]) => (init as RequestInit | undefined)?.method === 'PATCH',
      );
      expect(String(patch![0])).toBe('/tenant/fnb/settings');
      expect(JSON.parse(String((patch![1] as RequestInit).body))).toEqual({
        roomChargeEnabled: true,
      });
    });
  });

  it('readOnly disables the save button', async () => {
    tenant.readOnly = true;
    renderPage();
    const button = await screen.findByRole('button', { name: 'Save' });
    expect(button.hasAttribute('disabled')).toBe(true);
  });
});
