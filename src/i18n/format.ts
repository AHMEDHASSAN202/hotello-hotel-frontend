import type { Locale } from './config';

/**
 * Locale-aware formatting helpers. Pure functions — the React hooks in
 * `use-format.ts` wrap these with the active locale.
 *
 * BOTH locales use Latin digits (0-9). We force the `latn` numbering system so
 * `ar-EG` does not fall back to Eastern Arabic numerals (٠-٩). Gregorian
 * calendar in both languages; Africa/Cairo default zone.
 */

export const PLATFORM_TIMEZONE = 'Africa/Cairo';
export const DEFAULT_CURRENCY = 'EGP';

/** Intl locale tag with Latin digits forced. */
function intlLocale(locale: Locale): string {
  return locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US-u-nu-latn';
}

function toDate(value: Date | string | number): Date {
  return value instanceof Date ? value : new Date(value);
}

export function formatNumber(
  value: number,
  locale: Locale,
  options: Intl.NumberFormatOptions = {},
): string {
  return new Intl.NumberFormat(intlLocale(locale), options).format(value);
}

export function formatCurrency(
  value: number,
  locale: Locale,
  currency: string = DEFAULT_CURRENCY,
  options: Intl.NumberFormatOptions = {},
): string {
  return new Intl.NumberFormat(intlLocale(locale), {
    style: 'currency',
    currency,
    ...options,
  }).format(value);
}

export function formatDate(
  value: Date | string | number,
  locale: Locale,
  options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' },
): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone: PLATFORM_TIMEZONE,
    calendar: 'gregory',
    ...options,
  }).format(toDate(value));
}

export function formatDateTime(
  value: Date | string | number,
  locale: Locale,
): string {
  return formatDate(value, locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const RELATIVE_UNITS: Array<{ unit: Intl.RelativeTimeFormatUnit; ms: number }> = [
  { unit: 'year', ms: 365 * 24 * 60 * 60 * 1000 },
  { unit: 'month', ms: 30 * 24 * 60 * 60 * 1000 },
  { unit: 'day', ms: 24 * 60 * 60 * 1000 },
  { unit: 'hour', ms: 60 * 60 * 1000 },
  { unit: 'minute', ms: 60 * 1000 },
  { unit: 'second', ms: 1000 },
];

export function formatRelativeTime(
  value: Date | string | number,
  locale: Locale,
  now: Date | number = new Date(),
): string {
  const diffMs = toDate(value).getTime() - toDate(now).getTime();
  const rtf = new Intl.RelativeTimeFormat(intlLocale(locale), { numeric: 'auto' });
  const absMs = Math.abs(diffMs);

  for (const { unit, ms } of RELATIVE_UNITS) {
    if (absMs >= ms || unit === 'second') {
      return rtf.format(Math.round(diffMs / ms), unit);
    }
  }
  return rtf.format(0, 'second');
}
