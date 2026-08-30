import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import en from '../../../../../../../messages/en';

/**
 * Epic 21 (Task 2/16) AC2 — the F&B settings spot is now a guidance pointer,
 * not the payment-methods form (that moved to `/settings/payment-methods`).
 * It stays a real page (not a hard redirect) so staff who land here out of
 * habit see where the setting lives now.
 */

const tenant = vi.hoisted(() => ({
  hasPermission: vi.fn(() => true),
}));

vi.mock('@/components/tenant-provider', () => ({ useTenant: () => tenant }));
vi.mock('next/navigation', () => ({ useParams: () => ({ slug: 'sunrise' }) }));

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
});

describe('FnbSettingsPage pointer (Epic 21 AC2)', () => {
  it('shows the guidance card with a link to the new hotel-level settings page', () => {
    renderPage();
    expect(screen.getByText('Payment methods have moved')).toBeTruthy();
    const link = screen.getByRole('link', { name: /Go to payment settings/ });
    expect(link.getAttribute('href')).toBe('/t/sunrise/settings/payment-methods');
  });

  it('hides the guidance card and shows the no-access state without fnb_settings.manage', () => {
    tenant.hasPermission.mockReturnValue(false);
    renderPage();
    expect(screen.queryByText('Payment methods have moved')).toBeNull();
    expect(screen.getByText("You don't have access to F&B orders")).toBeTruthy();
  });

  it('gates on the stable fnb_settings.manage permission (not a new key)', () => {
    renderPage();
    expect(tenant.hasPermission).toHaveBeenCalledWith('fnb_settings.manage');
  });
});
