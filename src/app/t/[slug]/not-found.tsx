import { getTranslations } from 'next-intl/server';

/**
 * Branded "hotel not found" — rendered when GET /tenant/public/context/:slug
 * returns 404 (unknown or inactive hotel). Story 8.1.
 */
export default async function TenantNotFound() {
  const t = await getTranslations('errors');
  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-deep p-8 text-center">
      <div className="max-w-md">
        <p className="text-xs font-semibold uppercase tracking-widest text-gold">
          Hotello · GXP
        </p>
        <h1 className="mt-3 font-display text-2xl font-semibold text-white">
          {t('notFoundTitle')}
        </h1>
        <p className="mt-2 text-sm text-white/60">{t('notFoundBody')}</p>
        <p className="mt-8 text-[10px] uppercase tracking-widest text-white/30">
          Powered by GXP
        </p>
      </div>
    </main>
  );
}
