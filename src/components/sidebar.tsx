'use client';

import {
  BarChart3,
  Car,
  LayoutDashboard,
  LogOut,
  type LucideIcon,
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
import type { ModuleKey } from '@/lib/types';
import { brandLogo, brandName, useTenantBrand } from './tenant-brand-provider';
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
};

const NAV_ITEMS: NavItem[] = [
  { segment: '', labelKey: 'overview', icon: LayoutDashboard },
  { segment: 'transportation', labelKey: 'transportation', icon: Car, module: 'transportation' },
  { segment: 'housekeeping', labelKey: 'housekeeping', icon: Sparkles, module: 'housekeeping' },
  { segment: 'fnb', labelKey: 'fnb', icon: UtensilsCrossed, module: 'fnb' },
  { segment: 'branding', labelKey: 'branding', icon: Paintbrush, module: 'guest_app_branding' },
  { segment: 'analytics', labelKey: 'analytics', icon: BarChart3, module: 'analytics' },
  { segment: 'staff', labelKey: 'staff', icon: Users, permission: 'staff.read' },
  { segment: 'roles', labelKey: 'roles', icon: ShieldCheck, permission: 'roles.read' },
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
  const [collapsed, setCollapsed] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const base = `/t/${slug}`;
  const logo = brandLogo(brand.logoUrl);
  const name = brandName(brand, locale);

  const visibleItems = NAV_ITEMS.filter(
    (item) =>
      (!item.module || isModuleEnabled(item.module)) &&
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
      className={`flex h-screen flex-col bg-ink-deep text-white transition-[width] duration-200 ${
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

      <nav className="flex-1 space-y-1 px-2" aria-label={t('nav.main')}>
        {visibleItems.map(({ segment, labelKey, icon: Icon }) => {
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
              <Icon size={17} aria-hidden className="shrink-0" />
              {!collapsed && t(`nav.${labelKey}`)}
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
