'use client';

import { useTranslations } from 'next-intl';
import { Banner } from './ui';
import { useTenant } from './tenant-provider';

/**
 * Persistent subscription surfaces (Story 8.6):
 *  - trial countdown → a conversion-oriented banner using trialDaysRemaining
 *  - read-only → a warning explaining the limited state + conversion prompt
 *  - past_due / expired / canceled → a danger banner
 */
export function SubscriptionBanners() {
  const t = useTranslations('subscription');
  const { me } = useTenant();
  if (!me) return null;

  const sub = me.subscription;
  const banners: React.ReactNode[] = [];

  if (sub.status === 'trial' && sub.trialDaysRemaining != null) {
    const days = sub.trialDaysRemaining;
    banners.push(
      <Banner
        key="trial"
        variant="trial"
        title={t('trial.title', { days })}
      >
        {t('trial.body')}
      </Banner>,
    );
  }

  if (sub.status === 'past_due') {
    banners.push(
      <Banner key="past_due" variant="warning" title={t('pastDue.title')}>
        {t('pastDue.body')}
      </Banner>,
    );
  }

  if (sub.status === 'expired' || sub.status === 'canceled') {
    banners.push(
      <Banner
        key="ended"
        variant="danger"
        title={t(`${sub.status}.title`)}
      >
        {t(`${sub.status}.body`)}
      </Banner>,
    );
  }

  if (sub.readOnly) {
    banners.push(
      <Banner key="readonly" variant="warning" title={t('readOnly.title')}>
        {t('readOnly.body')}
      </Banner>,
    );
  }

  if (banners.length === 0) return null;
  return <div className="mb-6 space-y-3">{banners}</div>;
}
