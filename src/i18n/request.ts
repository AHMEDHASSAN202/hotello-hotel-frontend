import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import { defaultLocale, isLocale, LOCALE_COOKIE, type Locale } from './config';
import { loadMessages } from './messages';

/**
 * Locale strategy is cookie/profile-based — no locale URL prefix, so routes are
 * untouched. The layout re-reads this on every `router.refresh()`, which is how
 * switching applies instantly without a full navigation.
 */
export default getRequestConfig(async () => {
  const cookieLocale = cookies().get(LOCALE_COOKIE)?.value;
  const locale: Locale = isLocale(cookieLocale) ? cookieLocale : defaultLocale;

  return {
    locale,
    messages: loadMessages(locale),
    timeZone: 'Africa/Cairo',
  };
});
