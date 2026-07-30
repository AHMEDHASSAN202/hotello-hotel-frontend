import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { TenantBrandProvider } from '@/components/tenant-brand-provider';
import { TenantLocked } from '@/components/tenant-locked';
import {
  defaultLocale,
  dirFor,
  isLocale,
  LOCALE_COOKIE,
  type Locale,
} from '@/i18n/config';
import { loadMessages } from '@/i18n/messages';
import type { TenantContextPublic } from '@/lib/types';

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

/**
 * Server-side resolution of the hotel's public branding + status.
 *  - 404 → branded not-found (Story 8.1).
 *  - suspended → a full-page locked view for EVERY child route incl. login
 *    (Story 8.1 AC4).
 *
 * When no `gxp_locale` cookie is set, the hotel's defaultLanguage seeds the
 * initial locale so the first paint matches the hotel's preference.
 */
async function fetchContext(slug: string): Promise<TenantContextPublic | null> {
  try {
    const res = await fetch(
      `${BASE_URL}/tenant/public/context/${encodeURIComponent(slug)}`,
      { cache: 'no-store' },
    );
    if (res.status === 404) return null;
    if (!res.ok) return null;
    return (await res.json()) as TenantContextPublic;
  } catch {
    return null;
  }
}

export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string };
}) {
  const brand = await fetchContext(params.slug);
  if (!brand) notFound();

  // Initial locale: cookie wins, else the hotel's default language.
  const cookieLocale = cookies().get(LOCALE_COOKIE)?.value;
  const locale: Locale = isLocale(cookieLocale)
    ? cookieLocale
    : isLocale(brand.defaultLanguage)
      ? brand.defaultLanguage
      : defaultLocale;

  if (brand.status === 'suspended') {
    // Re-scope the intl context to the resolved locale so the locked view honors
    // the hotel's default language even before any cookie is set.
    const messages = loadMessages(locale);
    return (
      <NextIntlClientProvider locale={locale} messages={messages}>
        <div lang={locale} dir={dirFor(locale)}>
          <TenantBrandProvider brand={brand}>
            <TenantLocked />
          </TenantBrandProvider>
        </div>
      </NextIntlClientProvider>
    );
  }

  // Active hotel: load the bundle for the RESOLVED locale (which may be seeded
  // from the hotel's default language, not the cookie — getMessages() would
  // resolve cookie-only and hand an English bundle to an Arabic locale). The
  // lang/dir wrapper covers the case where the seeded locale differs from the
  // cookie-derived <html> attributes on first paint.
  const messages = loadMessages(locale);
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <div lang={locale} dir={dirFor(locale)}>
        <TenantBrandProvider brand={brand}>{children}</TenantBrandProvider>
      </div>
    </NextIntlClientProvider>
  );
}
