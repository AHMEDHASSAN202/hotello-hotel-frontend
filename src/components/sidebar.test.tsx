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
    expect(screen.queryByText('Requests')).toBeNull();
    // Branding and Analytics are both upsell modules (18.3, then 22.6): they
    // stay visible with an Upgrade badge instead of disappearing, even
    // though neither is in this plan.
    const branding = screen.getByText('Guest App Branding').closest('a');
    const analytics = screen.getByText('Analytics').closest('a');
    expect(branding?.querySelector('[data-testid="nav-upgrade-badge"]')).toBeTruthy();
    expect(analytics?.querySelector('[data-testid="nav-upgrade-badge"]')).toBeTruthy();
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

describe('Epic 19 — announcements nav gating', () => {
  it('renders as a link when the module is enabled and permission held', () => {
    renderSidebar(['announcements']);
    const item = screen.getByText(en.shell.nav.announcements).closest('a');
    expect(item?.getAttribute('href')).toBe('/t/sunrise/announcements');
    expect(item?.querySelector('[data-testid="nav-soon-badge"]')).toBeNull();
  });

  it('hidden entirely when the module is missing from the plan (backfilled, not an upsell)', () => {
    renderSidebar(['fnb']);
    expect(screen.queryByText(en.shell.nav.announcements)).toBeNull();
    // No Upgrade badge either — announcements is not an upsell module.
  });

  it('hidden without announcements.manage even with the module in plan', () => {
    tenant.isModuleEnabled = () => true;
    tenant.hasPermission = (k: string) => k !== 'announcements.manage';
    renderSidebar();
    expect(screen.queryByText(en.shell.nav.announcements)).toBeNull();
  });
});

describe('Epic 21 — events nav gating (final-review Minor)', () => {
  it('renders as a link when the events module is enabled and events.read is held', () => {
    renderSidebar(['events']);
    const item = screen.getByText(en.shell.nav.events).closest('a');
    expect(item?.getAttribute('href')).toBe('/t/sunrise/events');
    expect(item?.querySelector('[data-testid="nav-soon-badge"]')).toBeNull();
  });

  it('hidden entirely when the events module is missing from the plan', () => {
    renderSidebar(['fnb']);
    expect(screen.queryByText(en.shell.nav.events)).toBeNull();
  });

  it('hidden without events.read even with the module in plan', () => {
    tenant.isModuleEnabled = () => true;
    tenant.hasPermission = (k: string) => k !== 'events.read';
    renderSidebar();
    expect(screen.queryByText(en.shell.nav.events)).toBeNull();
  });
});

describe('Epic 21 — hotel settings (payment methods) nav', () => {
  it('renders as a link even with no plan modules enabled — it is not module-gated', () => {
    renderSidebar([]);
    const item = screen.getByText(en.shell.nav.settings).closest('a');
    expect(item?.getAttribute('href')).toBe(
      '/t/sunrise/settings/payment-methods',
    );
  });

  it('hidden without fnb_settings.manage', () => {
    tenant.isModuleEnabled = () => true;
    tenant.hasPermission = (k: string) => k !== 'fnb_settings.manage';
    renderSidebar();
    expect(screen.queryByText(en.shell.nav.settings)).toBeNull();
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

describe('guest-polish-v1 item C8 — sidebar grouped sections', () => {
  it('renders section labels in the specified order', () => {
    renderSidebar([
      'requests',
      'fnb',
      'housekeeping',
      'transportation',
      'announcements',
      'events',
      'hotel_info',
      'guest_app_branding',
      'analytics',
    ]);
    const labels = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(labels).toEqual(['Daily operations', 'Guest engagement', 'Business', 'Setup']);
  });

  it('places Transportation (SOON) at the end of Daily operations', () => {
    renderSidebar(['requests', 'fnb', 'housekeeping', 'transportation']);
    const section = screen.getByText('Daily operations').closest('section');
    const entries = section!.querySelectorAll('a, [aria-disabled="true"]');
    expect(entries[entries.length - 1]?.textContent).toContain('Transportation');
  });

  it('places Guest App Branding (UPGRADE) at the end of Guest engagement', () => {
    // guest_app_branding intentionally left out of enabledModules — branding
    // is an upsell module, so it still renders as a link with an Upgrade badge.
    renderSidebar(['announcements', 'events', 'hotel_info']);
    const section = screen.getByText('Guest engagement').closest('section');
    const links = section!.querySelectorAll('a');
    expect(links[links.length - 1]?.textContent).toContain('Guest App Branding');
  });

  it('keeps My profile out of the numbered sections, in the bottom block', () => {
    renderSidebar(['requests']);
    const sectionEls = screen.getAllByRole('heading', { level: 2 }).map((h) => h.closest('section'));
    sectionEls.forEach((section) => {
      expect(section?.textContent).not.toContain(en.shell.nav.profile);
    });
    expect(screen.getByText(en.shell.nav.profile).closest('a')).not.toBeNull();
  });
});
