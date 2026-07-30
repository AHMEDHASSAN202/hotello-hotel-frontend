/**
 * Single source of truth for the tenant dashboard's locales.
 *
 * Only this file lists the locales — never hardcode the list elsewhere.
 */
export const locales = ['en', 'ar'] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en';

/** Cookie the pre-login pages + middleware read to pick a locale. */
export const LOCALE_COOKIE = 'gxp_locale';

/** Locales that flow right-to-left. */
const rtlLocales: readonly Locale[] = ['ar'];

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (locales as readonly string[]).includes(value);
}

export function dirFor(locale: Locale): 'rtl' | 'ltr' {
  return rtlLocales.includes(locale) ? 'rtl' : 'ltr';
}

/** Native endonym shown in the language switcher. */
export const localeLabels: Record<Locale, string> = {
  en: 'English',
  ar: 'العربية',
};
