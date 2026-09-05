import { getTranslations } from 'next-intl/server';

/**
 * Bare-host landing. In production tenants reach the app via their subdomain
 * ({slug}.{base}) which the middleware rewrites to /t/{slug}. This page is only
 * hit at the apex domain, so it just explains that a hotel address is required.
 */
export default async function RootPage() {
  const t = await getTranslations('errors');
  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-deep p-8 text-center">
      <div className="max-w-md">
        <p className="text-xs font-semibold uppercase tracking-widest text-gold">
          GXP
        </p>
        <h1 className="mt-3 font-display text-2xl font-semibold text-white">
          {t('notFoundTitle')}
        </h1>
        <p className="mt-2 text-sm text-white/60">{t('notFoundBody')}</p>
      </div>
    </main>
  );
}
