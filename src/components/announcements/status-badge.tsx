'use client';

import { useTranslations } from 'next-intl';
import { InfoTip } from '@/components/guidance';
import { Badge } from '@/components/ui';
import type { AnnouncementStatus } from '@/lib/types';

const STATUS_TONE: Record<
  AnnouncementStatus,
  'neutral' | 'gold' | 'success' | 'danger' | 'warning'
> = {
  draft: 'neutral',
  scheduled: 'gold',
  live: 'success',
  retracted: 'danger',
  expired: 'warning',
};

/** 19.3 AC1 — status badge with its InfoTip (the house Badge+InfoTip pairing). */
export function AnnouncementStatusBadge({
  status,
}: {
  status: AnnouncementStatus;
}) {
  const t = useTranslations('announcements');
  const g = useTranslations('guidance.announcements');
  return (
    <span className="inline-flex items-center gap-1">
      <Badge tone={STATUS_TONE[status]}>{t(`status.${status}`)}</Badge>
      <InfoTip label={t(`status.${status}`)}>{g(`status.${status}`)}</InfoTip>
    </span>
  );
}
