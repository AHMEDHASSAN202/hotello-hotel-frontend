import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import en from '../../../../../../../messages/en';

/**
 * Epic 21 (Task 2/16) — payment methods lifted to the hotel-level settings
 * surface. Same behavior as the old F&B settings form (16.4), now hitting
 * `GET/PATCH tenant/settings/payment-methods` and gated on the same
 * `fnb_settings.manage` permission (the backend kept the key stable).
 */

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

import PaymentMethodsSettingsPage from './page';

function renderPage() {
  return render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Africa/Cairo">
      <PaymentMethodsSettingsPage />
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

describe('PaymentMethodsSettingsPage (Epic 21 Task 2/16)', () => {
  it('loads from the hotel-level endpoint — cash is always on (locked); room charge is the single opt-in', async () => {
    renderPage();
    const cash = (await screen.findByLabelText(/Cash/)) as HTMLInputElement;
    expect(cash.checked).toBe(true);
    expect(cash.disabled).toBe(true);

    const roomCharge = screen.getByLabelText(
      /Room charge \(pay at checkout\)/,
    ) as HTMLInputElement;
    expect(roomCharge.checked).toBe(false);
    expect(roomCharge.disabled).toBe(false);

    await waitFor(() => {
      expect(apiMock.api).toHaveBeenCalledWith('/tenant/settings/payment-methods');
    });
  });

  it('enabling room charge PATCHes the hotel-level settings endpoint', async () => {
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
      expect(String(patch![0])).toBe('/tenant/settings/payment-methods');
      expect(JSON.parse(String((patch![1] as RequestInit).body))).toEqual({
        roomChargeEnabled: true,
      });
    });
  });

  it('shows a retryable error state when loading fails', async () => {
    apiMock.api.mockReset();
    apiMock.api.mockRejectedValueOnce(new Error('network down'));
    renderPage();
    expect(
      await screen.findByText('Something went wrong. Please try again.'),
    ).toBeTruthy();

    apiMock.api.mockResolvedValueOnce({ cashEnabled: true, roomChargeEnabled: true });
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    const roomCharge = (await screen.findByLabelText(
      /Room charge \(pay at checkout\)/,
    )) as HTMLInputElement;
    expect(roomCharge.checked).toBe(true);
  });

  it('readOnly disables the save button', async () => {
    tenant.readOnly = true;
    renderPage();
    const button = await screen.findByRole('button', { name: 'Save' });
    expect(button.hasAttribute('disabled')).toBe(true);
  });

  it('gates on fnb_settings.manage and shows the payment-settings no-access state', () => {
    tenant.hasPermission.mockReturnValue(false);
    renderPage();
    expect(tenant.hasPermission).toHaveBeenCalledWith('fnb_settings.manage');
    expect(
      screen.getByText("You don't have access to payment settings"),
    ).toBeTruthy();
    expect(apiMock.api).not.toHaveBeenCalled();
  });
});
