import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../messages/en';
import { MODULE_PAGES } from '@/lib/modules';
import type { ModuleKey } from '@/lib/types';

/**
 * Nav gating for plan modules: a module missing from enabledModules stays
 * hidden (existing rule); a module in the plan but not yet built renders as a
 * non-clickable entry with the quiet "Soon" chip instead of a dead link.
 */

const tenant = vi.hoisted(() => ({
  enabledModules: [] as string[],
  isModuleEnabled: (key: string): boolean => tenant.enabledModules.includes(key),
  hasPermission: (_key: string): boolean => true,
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

/**
 * `enabledModules` drives the default `isModuleEnabled`/`hasPermission` gate;
 * pass nothing when a test has already overridden `tenant.isModuleEnabled` /
 * `tenant.hasPermission` directly (Epic 18 upsell cases below).
 */
function renderSidebar(enabledModules?: string[]) {
  if (enabledModules) {
    tenant.enabledModules = enabledModules;
    tenant.isModuleEnabled = (key: string) => tenant.enabledModules.includes(key);
    tenant.hasPermission = () => true;
  }
  return render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Africa/Cairo">
      <Sidebar />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  tenant.enabledModules = [];
  tenant.isModuleEnabled = (key: string) => tenant.enabledModules.includes(key);
  tenant.hasPermission = () => true;
});

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

  it('a module missing from the plan stays hidden, built or not — except upsell modules, which flip to visible-with-badge (18.3)', () => {
    renderSidebar(['fnb']);
    expect(screen.queryByText('Transportation')).toBeNull();
    expect(screen.queryByText('Analytics')).toBeNull();
    expect(screen.queryByText('Requests')).toBeNull();
    // Branding is an upsell module (18.3): it stays visible with an Upgrade
    // badge instead of disappearing, even though it's not in this plan.
    expect(screen.getByText('Guest App Branding')).toBeTruthy();
    expect(screen.getByTestId('nav-upgrade-badge')).toBeTruthy();
  });

  it('every unbuilt module in the plan gets its own Soon chip', () => {
    const modules = Object.keys(MODULE_PAGES) as ModuleKey[];
    renderSidebar(modules);
    // Derived from MODULE_PAGES so shipping a module's page (flipping `built`)
    // never leaves this count stale.
    const unbuilt = modules.filter((key) => !MODULE_PAGES[key].built);
    expect(screen.getAllByTestId('nav-soon-badge')).toHaveLength(unbuilt.length);
  });
});

describe('Epic 18 — upsell vs permission distinction (18.3 AC1/AC3)', () => {
  it('branding stays visible with an Upgrade badge when the module is not in the plan', () => {
    // Every other module enabled (so their own Soon chips are irrelevant
    // noise here) — only branding is out of the plan.
    tenant.isModuleEnabled = (k: string) => k !== 'guest_app_branding';
    tenant.hasPermission = () => true;
    renderSidebar();
    const branding = screen.getByText(en.shell.nav.branding).closest('a');
    expect(branding).not.toBeNull();
    expect(branding?.querySelector('[data-testid="nav-upgrade-badge"]')).toBeTruthy();
    expect(branding?.querySelector('[data-testid="nav-soon-badge"]')).toBeNull();
  });

  it('branding is hidden when the user lacks branding.manage — even with the module in plan', () => {
    tenant.isModuleEnabled = () => true;
    tenant.hasPermission = (k: string) => k !== 'branding.manage';
    renderSidebar();
    expect(screen.queryByText(en.shell.nav.branding)).toBeNull();
  });

  it('non-upsell modules missing from the plan stay hidden (existing behavior)', () => {
    tenant.isModuleEnabled = (k: string) => k !== 'fnb';
    tenant.hasPermission = () => true;
    renderSidebar();
    expect(screen.queryByText(en.shell.nav.fnb)).toBeNull();
  });
});
