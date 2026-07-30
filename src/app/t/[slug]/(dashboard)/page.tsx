'use client';

import { LayoutDashboard } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui';
import { useTenant } from '@/components/tenant-provider';
import { useApiError } from '@/lib/errors';
import type { Locale } from '@/i18n/config';

export default function OverviewPage() {
  const t = useTranslations('shell.overview');
  const locale = useLocale() as Locale;
  const resolveError = useApiError();
  const { me, loading, error, reload } = useTenant();

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (error || !me) {
    return <ErrorState message={resolveError(error)} onRetry={reload} />;
  }

  const planName =
    locale === 'ar'
      ? me.subscription.planNameAr
      : me.subscription.planNameEn;

  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-widest text-gold">
        {t('eyebrow')}
      </p>
      <h1 className="mt-1 font-display text-2xl font-semibold text-ink">
        {t('welcome', { name: me.user.name })}
      </h1>
      <p className="mt-1 text-sm text-ink-soft">{t('subtitle')}</p>

      <div className="mt-6 rounded-xl border border-line bg-white p-5">
        <p className="text-xs uppercase tracking-widest text-ink-soft">
          {t('planLabel')}
        </p>
        <p className="mt-1 font-display text-lg font-semibold text-ink">
          {planName ?? t('noPlan')}
        </p>
      </div>

      <div className="mt-6">
        <EmptyState
          icon={<LayoutDashboard size={28} />}
          title={t('emptyTitle')}
          hint={t('emptyHint')}
        />
      </div>
    </div>
  );
}
