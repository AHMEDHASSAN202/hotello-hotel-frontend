'use client';

import { useTranslations } from 'next-intl';
import { PageIntro } from '@/components/guidance';

/** Epic 17 — placeholder shell; the management page lands in the next task. */
export default function HotelInfoPage() {
  const t = useTranslations('hotelInfo');
  const g = useTranslations('guidance.hotelInfo');
  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-ink">
        {t('title')}
      </h1>
      <PageIntro>{g('intro')}</PageIntro>
    </div>
  );
}
