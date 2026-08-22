'use client';

import { UserRound } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { InfoTip } from '@/components/guidance';
import { Badge, Bdi } from '@/components/ui';
import { useFormatters } from '@/i18n/use-format';
import type { TenantRequestView } from '@/lib/types';
import { slaState } from './board-logic';
import { requestIcon } from './request-icons';

/**
 * One board card (15.4 AC1): item in the staff language, room, guest,
 * option/note (note verbatim + guest-language tag — the honest MVP of the
 * language barrier), live age, status + SLA chips, assignee. Click opens
 * the lifecycle drawer.
 */
const STATUS_TONE: Record<
  TenantRequestView['status'],
  'gold' | 'warning' | 'success' | 'neutral'
> = {
  new: 'gold',
  in_progress: 'warning',
  done: 'success',
  cancelled: 'neutral',
};

export function RequestCard({
  request,
  now,
  onOpen,
}: {
  request: TenantRequestView;
  now: Date;
  onOpen: (request: TenantRequestView) => void;
}) {
  const t = useTranslations('requests');
  const tG = useTranslations('guidance.requests');
  const { locale, formatRelativeTime } = useFormatters();
  const Icon = requestIcon(request.icon);
  const name = locale === 'ar' ? request.itemNameAr : request.itemNameEn;
  const sla = slaState(request, now);
  const elapsedMinutes = Math.max(
    0,
    Math.round((now.getTime() - new Date(request.createdAt).getTime()) / 60_000),
  );

  return (
    <button
      data-testid={`request-card-${request.id}`}
      onClick={() => onOpen(request)}
      className="w-full animate-banner-in rounded-xl border border-line bg-white p-4 text-start shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold-soft">
          <Icon size={18} className="text-ink" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-ink">
              {name}
              {request.optionType === 'quantity' && request.optionValue
                ? ` ×${request.optionValue}`
                : ''}
              {request.optionType === 'time' && request.optionValue
                ? ` · ${request.optionValue}`
                : ''}
            </span>
            <Badge tone={STATUS_TONE[request.status]}>
              {t(`status.${request.status}`)}
            </Badge>
            <InfoTip label={t(`status.${request.status}`)}>
              {tG(`status.${request.status}`)}
            </InfoTip>
            {sla === 'overdue' ? (
              <>
                <Badge tone="danger">{t('sla.overdue')}</Badge>
                <InfoTip label={t('sla.overdue')}>{tG('sla')}</InfoTip>
              </>
            ) : sla === 'warning' ? (
              <>
                <Badge tone="warning">
                  {t('sla.progress', {
                    elapsed: elapsedMinutes,
                    target: request.slaTargetMinutes,
                  })}
                </Badge>
                <InfoTip label={t('sla.label')}>{tG('sla')}</InfoTip>
              </>
            ) : (
              <span className="text-xs tabular-nums text-ink-soft">
                {t('sla.progress', {
                  elapsed: elapsedMinutes,
                  target: request.slaTargetMinutes,
                })}
              </span>
            )}
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-ink-soft">
            <span>
              {t('card.room')} <Bdi>{request.roomNumber}</Bdi>
            </span>
            {request.floor !== null && (
              <span>· {t('card.floor', { floor: request.floor })}</span>
            )}
            <span>· {request.guestName}</span>
            <span className="text-ink-soft/70">
              · {formatRelativeTime(request.createdAt, now)}
            </span>
          </p>
          {request.note ? (
            <p className="mt-1.5 flex items-center gap-1.5 text-sm text-ink">
              <span className="truncate italic">“{request.note}”</span>
              {request.noteLanguage ? (
                <>
                  <span className="shrink-0 rounded bg-line/60 px-1 text-[10px] font-bold uppercase tracking-wider text-ink-soft">
                    {request.noteLanguage}
                  </span>
                  <InfoTip label={t('card.noteTag')}>{tG('noteLanguage')}</InfoTip>
                </>
              ) : null}
            </p>
          ) : null}
        </div>
        {request.assignedTo ? (
          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-paper px-2.5 py-1 text-xs font-medium text-ink-soft">
            <UserRound size={12} aria-hidden />
            {request.assignedTo.name}
          </span>
        ) : null}
      </div>
    </button>
  );
}
