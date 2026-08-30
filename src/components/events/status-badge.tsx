'use client';

import { useTranslations } from 'next-intl';
import { InfoTip } from '@/components/guidance';
import { Badge } from '@/components/ui';
import type { EventStatus } from '@/lib/types';

const STATUS_TONE: Record<
  EventStatus,
  'neutral' | 'gold' | 'success' | 'danger' | 'warning'
> = {
  draft: 'neutral',
  published: 'success',
  // Final-review fix (Minor) — 'gold' means active/pending/awaiting-action
  // everywhere else this app uses it (incl. the attendees page's own
  // 'booked' badge); 'completed' is terminal/settled, which 'neutral'
  // already means elsewhere, so it shares gold with 'booked' no longer.
  completed: 'neutral',
  cancelled: 'danger',
};

/** Epic 21, Story 21.2 AC4 — status badge with its InfoTip (the house Badge+InfoTip pairing). */
export function EventStatusBadge({ status }: { status: EventStatus }) {
  const t = useTranslations('events');
  const g = useTranslations('guidance.events');
  return (
    <span className="inline-flex items-center gap-1">
      <Badge tone={STATUS_TONE[status]}>{t(`status.${status}`)}</Badge>
      <InfoTip label={t(`status.${status}`)}>{g(`status.${status}`)}</InfoTip>
    </span>
  );
}
