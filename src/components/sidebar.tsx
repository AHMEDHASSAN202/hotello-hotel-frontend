'use client';

import {
  BarChart3,
  BedDouble,
  BookOpen,
  Car,
  ConciergeBell,
  DoorOpen,
  LayoutDashboard,
  LogOut,
  type LucideIcon,
  Megaphone,
  PanelLeftClose,
  PanelLeftOpen,
  Paintbrush,
  ShieldCheck,
  Sparkles,
  UserCircle,
  Users,
  UtensilsCrossed,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import type { Locale } from '@/i18n/config';
import { api } from '@/lib/api';
import { tokenStore } from '@/lib/auth';
import { isModuleBuilt } from '@/lib/modules';
import type { ModuleKey } from '@/lib/types';
import { brandLogo, brandName, useTenantBrand } from './tenant-brand-provider';
import { useFnbFeed } from './fnb/fnb-feed-provider';
import { useHousekeepingFeed } from './housekeeping/housekeeping-feed-provider';
import { useRequestsFeed } from './requests/requests-feed-provider';
import { useTenant } from './tenant-provider';

/**
 * Nav items keyed by module and/or permission. An item with a `module` is
 * hidden unless that module is in enabledModules; an item with a `permission`
 * is hidden unless the user's role grants it. UX only — the backend guards
 * every route regardless. `labelKey` resolves against the `shell.nav` namespace.
 */
type NavItem = {
  segment: string;
  labelKey: string;
  icon: LucideIcon;
  module?: ModuleKey;
  permission?: string;
  /** Plan-gated upsell module: stays visible with an Upgrade badge when not in the plan (18.3). */
  upsell?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { segment: '', labelKey: 'overview', icon: LayoutDashboard },
  { segment: 'transportation', labelKey: 'transportation', icon: Car, module: 'transportation' },
  // Epic 20 — the cleaning board; badge shows the rooms-to-clean count.
  {
    segment: 'housekeeping',
    labelKey: 'housekeeping',
    icon: Sparkles,
    module: 'housekeeping',
    permission: 'housekeeping.read',
  },
  // Epic 16 — the kitchen board; badge shows the open-orders count.
  {
    segment: 'fnb',
    labelKey: 'fnb',
    icon: UtensilsCrossed,
    module: 'fnb',
    permission: 'fnb_orders.read',
  },
  {
    segment: 'branding',
    labelKey: 'branding',
    icon: Paintbrush,
    module: 'guest_app_branding',
    permission: 'branding.manage',
    upsell: true,
  },
  { segment: 'analytics', labelKey: 'analytics', icon: BarChart3, module: 'analytics' },
  // Epic 15 — the live guest-requests board; badge shows the open count.
  {
    segment: 'requests',
    labelKey: 'requests',
    icon: ConciergeBell,
    module: 'requests',
    permission: 'requests.read',
  },
  // Epic 17 — the guest-facing directory (WiFi, facilities, house rules).
  {
    segment: 'hotel-info',
    labelKey: 'hotelInfo',
    icon: BookOpen,
    module: 'hotel_info',
    permission: 'hotel_info.manage',
  },
  // Epic 19 — the hotel speaks to its guests (compose, schedule, read stats).
  {
    segment: 'announcements',
    labelKey: 'announcements',
    icon: Megaphone,
    module: 'announcements',
    permission: 'announcements.manage',
  },
  // Front-desk daily driver — listed before the setup-ish sections (Epic 13).
  { segment: 'stays', labelKey: 'stays', icon: DoorOpen, permission: 'stays.read' },
  { segment: 'staff', labelKey: 'staff', icon: Users, permission: 'staff.read' },
  { segment: 'roles', labelKey: 'roles', icon: ShieldCheck, permission: 'roles.read' },
  { segment: 'rooms', labelKey: 'rooms', icon: BedDouble, permission: 'rooms.read' },
  { segment: 'profile', labelKey: 'profile', icon: UserCircle },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const locale = useLocale() as Locale;
  const t = useTranslations('shell');
  const brand = useTenantBrand();
  const { isModuleEnabled, hasPermission } = useTenant();
  const { counts } = useRequestsFeed();
  const { counts: fnbCounts } = useFnbFeed();
  const { counts: hkCounts } = useHousekeepingFeed();
  const [collapsed, setCollapsed] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const openRequests = counts?.open ?? 0;
  const openOrders = fnbCounts?.open ?? 0;
  // Epic 20 — rooms currently waiting for a clean (checkout + daily).
  const roomsToClean = hkCounts
    ? hkCounts.toCleanCheckout + hkCounts.toCleanDaily
    : 0;

  const base = `/t/${slug}`;
  const logo = brandLogo(brand.logoUrl);
  const name = brandName(brand, locale);

  const visibleItems = NAV_ITEMS.filter(
    (item) =>
      (!item.module || isModuleEnabled(item.module) || item.upsell) &&
      (!item.permission || hasPermission(item.permission)),
  );

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await api<void>('/tenant/auth/logout', { method: 'POST' });
    } catch {
      // Local logout still proceeds if the API call fails.
    }
    tokenStore.clear();
    router.push(`${base}/login`);
  }

  return (
    <aside
      // sticky + h-screen: the shell (`min-h-screen`) grows with the page and
      // the *body* scrolls, so a non-sticky sidebar ends after the first
      // viewport and scrolling reveals a blank gutter below it.
      className={`sticky top-0 flex h-screen flex-col bg-ink-deep text-white transition-[width] duration-200 ${
        collapsed ? 'w-16' : 'w-60'
      }`}
    >
      {/* Hotel-first branding */}
      <div className="flex items-center gap-3 px-4 py-5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white/10">
          {logo ? (
            <Image
              src={logo}
              alt={name}
              width={36}
              height={36}
              className="h-9 w-9 object-cover"
              unoptimized
            />
          ) : (
            <span className="font-display text-sm font-bold text-gold">
              {name.slice(0, 1)}
            </span>
          )}
        </span>
        {!collapsed && (
          <span className="min-w-0 truncate font-display text-sm font-semibold">
            {name}
          </span>
        )}
      </div>

      <nav
        className="flex-1 space-y-1 overflow-y-auto px-2"
        aria-label={t('nav.main')}
      >
        {visibleItems.map(({ segment, labelKey, icon: Icon, module, upsell }) => {
          // Upsell module not in the plan (18.3) — stays a real, clickable
          // link with an Upgrade badge instead of disappearing or going
          // inert; only reachable for items with `upsell: true` since the
          // filter above already dropped non-upsell out-of-plan modules.
          const locked = Boolean(module && upsell && !isModuleEnabled(module));
          // In the plan but not built yet — visible ambition, inert entry
          // (`lib/modules.ts`); its route shows the ComingSoon page.
          if (module && !locked && !isModuleBuilt(module)) {
            return (
              <span
                key={labelKey}
                aria-disabled="true"
                title={
                  collapsed
                    ? `${t(`nav.${labelKey}`)} — ${t('nav.soon')}`
                    : undefined
                }
                className="flex cursor-default items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white/40"
              >
                <Icon size={17} aria-hidden className="shrink-0" />
                {!collapsed && (
                  <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                    <span className="truncate">{t(`nav.${labelKey}`)}</span>
                    <span
                      data-testid="nav-soon-badge"
                      className="rounded-full border border-white/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white/45"
                    >
                      {t('nav.soon')}
                    </span>
                  </span>
                )}
              </span>
            );
          }
          const href = segment ? `${base}/${segment}` : base;
          const active =
            segment === ''
              ? pathname === base
              : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={labelKey}
              href={href}
              aria-current={active ? 'page' : undefined}
              title={collapsed ? t(`nav.${labelKey}`) : undefined}
              className={`relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                active
                  ? 'bg-white/10 font-medium text-white'
                  : 'text-white/70 hover:bg-white/5 hover:text-white'
              }`}
            >
              {active && (
                <span
                  aria-hidden
                  className="absolute start-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-e bg-gold"
                />
              )}
              <span className="relative shrink-0">
                <Icon size={17} aria-hidden />
                {/* Epic 15 — collapsed-mode badge survives as a corner dot. */}
                {((labelKey === 'requests' && openRequests > 0) ||
                  (labelKey === 'fnb' && openOrders > 0) ||
                  (labelKey === 'housekeeping' && roomsToClean > 0)) &&
                  collapsed && (
                    <span
                      aria-hidden
                      className="absolute -end-1 -top-1 h-2 w-2 rounded-full bg-gold"
                    />
                  )}
              </span>
              {!collapsed && (
                <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                  <span className="truncate">{t(`nav.${labelKey}`)}</span>
                  {locked && (
                    <span
                      data-testid="nav-upgrade-badge"
                      className="ms-auto rounded-full bg-gold-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink"
                    >
                      {t('nav.upgrade')}
                    </span>
                  )}
                  {labelKey === 'requests' && openRequests > 0 && (
                    <span
                      data-testid="requests-nav-badge"
                      className="rounded-full bg-gold px-1.5 py-0.5 text-[10px] font-bold leading-none text-ink-deep"
                    >
                      {openRequests}
                    </span>
                  )}
                  {labelKey === 'fnb' && openOrders > 0 && (
                    <span
                      data-testid="fnb-nav-badge"
                      className="rounded-full bg-gold px-1.5 py-0.5 text-[10px] font-bold leading-none text-ink-deep"
                    >
                      {openOrders}
                    </span>
                  )}
                  {labelKey === 'housekeeping' && roomsToClean > 0 && (
                    <span
                      data-testid="housekeeping-nav-badge"
                      className="rounded-full bg-gold px-1.5 py-0.5 text-[10px] font-bold leading-none text-ink-deep"
                    >
                      {roomsToClean}
                    </span>
                  )}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-1 border-t border-white/10 p-2">
        <button
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? t('sidebar.expand') : t('sidebar.collapse')}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white/70 hover:bg-white/5 hover:text-white"
        >
          {collapsed ? (
            <PanelLeftOpen size={17} aria-hidden className="rtl:-scale-x-100" />
          ) : (
            <PanelLeftClose size={17} aria-hidden className="rtl:-scale-x-100" />
          )}
          {!collapsed && t('sidebar.collapse')}
        </button>
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          title={collapsed ? t('userMenu.signOut') : undefined}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white/70 hover:bg-white/5 hover:text-white disabled:opacity-50"
        >
          <LogOut size={17} aria-hidden className="shrink-0" />
          {!collapsed &&
            (loggingOut ? t('userMenu.signingOut') : t('userMenu.signOut'))}
        </button>
        {!collapsed && (
          <p className="px-3 pt-1 text-[10px] uppercase tracking-widest text-white/30">
            {t('poweredBy')}
          </p>
        )}
      </div>
    </aside>
  );
}
