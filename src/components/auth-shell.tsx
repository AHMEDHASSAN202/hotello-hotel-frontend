'use client';

import { useTranslations } from 'next-intl';
import { ReactNode } from 'react';
import { LanguageSwitcher } from './language-switcher';
import {
  brandLogo,
  useBrandName,
  useTenantBrand,
} from './tenant-brand-provider';

/**
 * Premium two-column auth layout: a hotel-branded panel + the form. Mirrors the
 * admin login composition but resolves the hotel's name/logo (hotel-first
 * branding; GXP is quiet, credited only as "Powered by").
 */
export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const t = useTranslations('auth.brandPanel');
  const brand = useTenantBrand();
  const name = useBrandName();
  const logo = brandLogo(brand.logoUrl);

  return (
    <main className="flex min-h-screen">
      {/* Brand panel */}
      <div className="hidden flex-1 flex-col justify-between bg-ink-deep p-12 lg:flex">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-white/10">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt={name} className="h-11 w-11 object-cover" />
            ) : (
              <span className="font-display text-lg font-bold text-gold">
                {name.slice(0, 1)}
              </span>
            )}
          </span>
          <p className="font-display text-xl font-bold text-white">{name}</p>
        </div>

        <p className="max-w-sm font-display text-3xl font-semibold leading-snug text-white">
          {t('taglineLead')}
          <span className="text-gold">{t('taglineAccent')}</span>
        </p>

        <div className="space-y-1">
          <p className="text-sm text-white/50">
            {t('copyright', {
              year: String(new Date().getFullYear()),
              hotel: name,
            })}
          </p>
          <p className="text-[10px] uppercase tracking-widest text-white/30">
            {t('poweredBy')}
          </p>
        </div>
      </div>

      {/* Form column */}
      <div className="flex flex-1 flex-col items-center justify-center bg-paper p-8">
        <div className="mb-6 flex w-full max-w-sm items-center justify-between lg:justify-end">
          {/* Hotel name shown on small screens where the brand panel is hidden. */}
          <p className="font-display text-lg font-semibold text-ink lg:hidden">
            {name}
          </p>
          <LanguageSwitcher persist={false} />
        </div>
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h1 className="font-display text-2xl font-semibold text-ink">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-1 text-sm text-ink-soft">{subtitle}</p>
            )}
          </div>
          {children}
        </div>
      </div>
    </main>
  );
}

/** Inline error alert used across auth forms. */
export function AuthError({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger"
    >
      {message}
    </div>
  );
}
