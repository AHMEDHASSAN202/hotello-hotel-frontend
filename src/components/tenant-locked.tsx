'use client';

import { Lock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { brandLogo, useBrandName, useTenantBrand } from './tenant-brand-provider';

/**
 * Full-page branded "locked / unavailable" view shown for EVERY child route of
 * a suspended hotel — including login (Story 8.1 AC4). No sign-in is offered.
 */
export function TenantLocked() {
  const t = useTranslations('subscription.locked');
  const brand = useTenantBrand();
  const name = useBrandName();
  const logo = brandLogo(brand.logoUrl);

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-deep p-8">
      <div className="max-w-md text-center">
        <span className="mx-auto mb-6 flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-white/10">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logo}
              alt={name}
              className="h-16 w-16 object-cover"
            />
          ) : (
            <Lock size={28} className="text-gold" aria-hidden />
          )}
        </span>
        <p className="text-sm font-medium text-white">{name}</p>
        <h1 className="mt-3 font-display text-2xl font-semibold text-white">
          {t('title')}
        </h1>
        <p className="mt-2 text-sm text-white/60">{t('body')}</p>
        <p className="mt-8 text-[10px] uppercase tracking-widest text-white/30">
          Powered by GXP
        </p>
      </div>
    </main>
  );
}
