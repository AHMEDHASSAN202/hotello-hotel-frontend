import type { AbstractIntlMessages } from 'next-intl';
import type { Locale } from './config';
import enMessages from '../../messages/en';
import arMessages from '../../messages/ar';

/**
 * Static per-locale message bundles. Each `messages/<locale>/index.ts`
 * re-exports its namespace JSON files, so webpack bundles them statically and
 * the completeness check (scripts/check-i18n.mjs) can diff the key sets.
 */
const bundles: Record<Locale, AbstractIntlMessages> = {
  en: enMessages,
  ar: arMessages,
};

/** Deep-merge `overlay` onto `base`; overlay values win, base fills the gaps. */
function deepMerge(
  base: AbstractIntlMessages,
  overlay: AbstractIntlMessages,
): AbstractIntlMessages {
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [key, value] of Object.entries(overlay as Record<string, unknown>)) {
    const prev = out[key];
    if (
      prev &&
      value &&
      typeof prev === 'object' &&
      typeof value === 'object' &&
      !Array.isArray(prev) &&
      !Array.isArray(value)
    ) {
      out[key] = deepMerge(
        prev as AbstractIntlMessages,
        value as AbstractIntlMessages,
      );
    } else {
      out[key] = value;
    }
  }
  return out as AbstractIntlMessages;
}

/**
 * Messages for a locale.
 *
 * In production a missing key falls back to English rather than showing a raw
 * key path — so non-`en` locales are layered over the full English bundle. In
 * development we return the locale's own bundle untouched, so a missing key
 * surfaces loudly.
 */
export function loadMessages(locale: Locale): AbstractIntlMessages {
  if (locale === 'en' || process.env.NODE_ENV === 'development') {
    return bundles[locale];
  }
  return deepMerge(bundles.en, bundles[locale]);
}
