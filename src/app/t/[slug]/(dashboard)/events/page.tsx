'use client';

import { useTranslations } from 'next-intl';
import { PageIntro } from '@/components/guidance';

/** Epic 21 — placeholder shell; the events list/management page lands in a later task. */
export default function EventsPage() {
  const t = useTranslations('events');
  const g = useTranslations('guidance.events');
  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-ink">
        {t('title')}
      </h1>
      <PageIntro>{g('intro')}</PageIntro>
    </div>
  );
}
