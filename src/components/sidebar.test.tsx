import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import en from '../../messages/en';

/**
 * Nav gating for plan modules: a module missing from enabledModules stays
 * hidden (existing rule); a module in the plan but not yet built renders as a
 * non-clickable entry with the quiet "Soon" chip instead of a dead link.
 */

const tenant = vi.hoisted(() => ({
  enabledModules: [] as string[],
  isModuleEnabled: (key: string) => tenant.enabledModules.includes(key),
  hasPermission: () => true,
}));

vi.mock('@/components/tenant-provider', () => ({
  useTenant: () => tenant,
}));

vi.mock('@/components/tenant-brand-provider', () => ({
  useTenantBrand: () => ({ logoUrl: null, nameEn: 'Sunrise', nameAr: 'صن رايز' }),
  brandLogo: () => null,
  brandName: () => 'Sunrise Hotel',
}));

vi.mock('@/components/requests/requests-feed-provider', () => ({
  useRequestsFeed: () => ({ counts: null }),
}));

vi.mock('@/components/fnb/fnb-feed-provider', () => ({
  useFnbFeed: () => ({ counts: null }),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/t/sunrise',
  useRouter: () => ({ push: vi.fn() }),
  useParams: () => ({ slug: 'sunrise' }),
}));

vi.mock('@/lib/api', () => ({ api: vi.fn() }));
vi.mock('@/lib/auth', () => ({ tokenStore: { clear: vi.fn() } }));

import { Sidebar } from './sidebar';

function renderSidebar(enabledModules: string[]) {
  tenant.enabledModules = enabledModules;
  return render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Africa/Cairo">
      <Sidebar />
    </NextIntlClientProvider>,
  );
}

describe('sidebar module gating', () => {
  it('a built module in the plan renders as a link without a Soon chip', () => {
    renderSidebar(['fnb', 'requests']);
    const fnb = screen.getByText('Food & Beverage').closest('a');
    expect(fnb?.getAttribute('href')).toBe('/t/sunrise/fnb');
    expect(screen.queryByTestId('nav-soon-badge')).toBeNull();
  });

  it('an unbuilt module in the plan renders non-clickable with the Soon chip', () => {
    renderSidebar(['transportation', 'fnb']);
    const label = screen.getByText('Transportation');
    expect(label.closest('a')).toBeNull();
    const entry = label.closest('[aria-disabled="true"]');
    expect(entry).not.toBeNull();
    expect(entry?.querySelector('[data-testid="nav-soon-badge"]')?.textContent).toBe(
      'Soon',
    );
  });

  it('a module missing from the plan stays hidden, built or not', () => {
    renderSidebar(['fnb']);
    expect(screen.queryByText('Transportation')).toBeNull();
    expect(screen.queryByText('Analytics')).toBeNull();
    expect(screen.queryByText('Requests')).toBeNull();
  });

  it('every unbuilt module in the plan gets its own Soon chip', () => {
    renderSidebar([
      'transportation',
      'housekeeping',
      'fnb',
      'guest_app_branding',
      'analytics',
      'requests',
    ]);
    expect(screen.getAllByTestId('nav-soon-badge')).toHaveLength(4);
  });
});
