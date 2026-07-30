'use client';

import { useTranslations } from 'next-intl';
import { localeLabels, locales } from '@/i18n/config';
import { useSetLocale } from '@/i18n/locale';

/**
 * EN ⇄ العربية switcher. Available on every page including login.
 *
 * `persist` writes the choice to the tenant profile (PATCH /tenant/me) so it
 * follows the user across devices — pass `persist={false}` on the pre-login
 * pages, where the cookie is the only store available.
 */
export function LanguageSwitcher({
  persist = true,
  className = '',
}: {
  persist?: boolean;
  className?: string;
}) {
  const t = useTranslations('common');
  const { locale, setLocale, pending } = useSetLocale();

  return (
    <div
      role="group"
      aria-label={t('language.switch')}
      className={`inline-flex items-center rounded-lg border border-line bg-white p-0.5 text-xs font-medium ${className}`}
    >
      {locales.map((l) => {
        const active = l === locale;
        return (
          <button
            key={l}
            type="button"
            lang={l}
            disabled={pending || active}
            aria-pressed={active}
            onClick={() => setLocale(l, { persist })}
            className={`rounded-md px-2.5 py-1 transition-colors ${
              active
                ? 'bg-ink text-white'
                : 'text-ink-soft hover:text-ink disabled:opacity-50'
            }`}
          >
            {localeLabels[l]}
          </button>
        );
      })}
    </div>
  );
}
