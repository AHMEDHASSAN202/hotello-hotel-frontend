'use client';

import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { api } from '@/lib/api';
import { LOCALE_COOKIE, type Locale } from './config';

/** One-year cookie so the choice survives sessions on this browser. */
export function setLocaleCookie(locale: Locale) {
  if (typeof document === 'undefined') return;
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
}

/**
 * Switches the dashboard language and applies it instantly.
 *
 * `router.refresh()` re-runs the server layout (which re-reads the cookie) while
 * preserving client component state — so the current route, filled form values,
 * and active filters survive the switch.
 */
export function useSetLocale() {
  const current = useLocale() as Locale;
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function setLocale(
    locale: Locale,
    { persist = true }: { persist?: boolean } = {},
  ) {
    if (locale === current) return;
    setLocaleCookie(locale);
    // Persist to the tenant profile so the choice follows them across devices.
    // Fire-and-forget — the cookie already covers this browser.
    if (persist) {
      api('/tenant/me', {
        method: 'PATCH',
        body: JSON.stringify({ preferredLanguage: locale }),
      }).catch(() => {});
    }
    startTransition(() => router.refresh());
  }

  return { locale: current, setLocale, pending };
}
