'use client';

import { Megaphone, ShieldAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTenant } from '@/components/tenant-provider';
import { PageIntro } from '@/components/guidance';
import { EmptyState } from '@/components/ui';

/**
 * Epic 19 — Announcements (19.2/19.3). List with status badges, audience
 * summaries and live read stats. Built out in the list task.
 */
export default function AnnouncementsPage() {
  const t = useTranslations('announcements');
  const g = useTranslations('guidance.announcements');
  const { hasPermission } = useTenant();
  const canManage = hasPermission('announcements.manage');

  if (!canManage) {
    return (
      <EmptyState
        icon={<ShieldAlert size={28} />}
        title={t('noPermission.title')}
        hint={t('noPermission.hint')}
      />
    );
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-ink">
        {t('title')}
      </h1>
      <PageIntro>{g('intro')}</PageIntro>
      <div className="mt-6">
        <EmptyState
          icon={<Megaphone size={28} />}
          title={t('empty.title')}
          hint={t('empty.hint')}
        />
      </div>
    </div>
  );
}
