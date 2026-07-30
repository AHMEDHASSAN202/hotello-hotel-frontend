'use client';

import { useLocale } from 'next-intl';
import { createContext, ReactNode, useContext } from 'react';
import type { Locale } from '@/i18n/config';
import { assetUrl } from '@/lib/api';
import type { TenantContextPublic } from '@/lib/types';

/**
 * Public, unauthenticated hotel branding resolved server-side from
 * GET /tenant/public/context/:slug. Available to every child (auth screens
 * included) so the whole tenant surface is hotel-branded from the first paint.
 */
const BrandContext = createContext<TenantContextPublic | null>(null);

export function TenantBrandProvider({
  brand,
  children,
}: {
  brand: TenantContextPublic;
  children: ReactNode;
}) {
  return (
    <BrandContext.Provider value={brand}>{children}</BrandContext.Provider>
  );
}

export function useTenantBrand(): TenantContextPublic {
  const ctx = useContext(BrandContext);
  if (!ctx) {
    throw new Error('useTenantBrand must be used within a TenantBrandProvider');
  }
  return ctx;
}

/** Locale-correct hotel name from a public/branding context. */
export function brandName(
  brand: { nameEn: string; nameAr: string },
  locale: Locale,
): string {
  return locale === 'ar' ? brand.nameAr || brand.nameEn : brand.nameEn;
}

/** Absolute logo URL, or null. `logoUrl` is a path relative to the API base. */
export function brandLogo(logoUrl: string | null): string | null {
  return logoUrl ? assetUrl(logoUrl) : null;
}

/** Convenience hook: the current-locale hotel name from public brand. */
export function useBrandName(): string {
  const brand = useTenantBrand();
  const locale = useLocale() as Locale;
  return brandName(brand, locale);
}
