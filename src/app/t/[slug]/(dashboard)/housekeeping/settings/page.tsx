'use client';

import { ShieldAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { PageIntro } from '@/components/guidance';
import { HousekeepingSettingsCard } from '@/components/housekeeping/housekeeping-settings-card';
import { useTenant } from '@/components/tenant-provider';
import { EmptyState } from '@/components/ui';

/**
 * 20.1 AC4 — the housekeeping settings subpage (daily service hour). Gated
 * by `housekeeping.update` (the PATCH permission, stays-settings precedent).
 */
export default function HousekeepingSettingsPage() {
  const t = useTranslations('housekeeping');
  const { hasPermission } = useTenant();
  const canUpdate = hasPermission('housekeeping.update');

  if (!canUpdate) {
    return (
      <EmptyState
        icon={<ShieldAlert size={28} />}
        title={t('noAccess.title')}
        hint={t('noAccess.hint')}
      />
    );
  }

  return (
    <div>
      <p className="text-xs uppercase tracking-widest text-gold">
        {t('eyebrow')}
      </p>
      <h1 className="mt-1 font-display text-2xl font-semibold text-ink">
        {t('settings.title')}
      </h1>
      <PageIntro>{t('settings.intro')}</PageIntro>

      <div className="mt-6">
        <HousekeepingSettingsCard />
      </div>
    </div>
  );
}
