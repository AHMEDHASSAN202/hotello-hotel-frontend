'use client';

import { Megaphone, ShieldAlert } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { AnnouncementDetailModal } from '@/components/announcements/announcement-detail-modal';
import { audienceSummary } from '@/components/announcements/audience-summary';
import { AnnouncementStatusBadge } from '@/components/announcements/status-badge';
import { ConfirmModal, ConsequenceNote, HintCard, InfoTip, PageIntro } from '@/components/guidance';
import { useTenant } from '@/components/tenant-provider';
import { Button, EmptyState, ErrorState, Skeleton } from '@/components/ui';
import { api } from '@/lib/api';
import { useApiError } from '@/lib/errors';
import { useFormatters } from '@/i18n/use-format';
import type { TenantAnnouncement } from '@/lib/types';

/**
 * Epic 19, Stories 19.2/19.3 — sent history: status badges, audience
 * summaries, hotel-local times and live read stats; per-row send/cancel/
 * retract with the inline-row-error pattern. Compose is a full page route.
 */
export default function AnnouncementsPage() {
  const t = useTranslations('announcements');
  const g = useTranslations('guidance.announcements');
  const locale = useLocale();
  const params = useParams<{ slug: string }>();
  const { hasPermission, readOnly, me } = useTenant();
  const resolveError = useApiError();
  const { formatDate } = useFormatters();
  const canManage = hasPermission('announcements.manage');
  const timezone = me?.hotel.timezone ?? 'Africa/Cairo';
  const base = `/t/${params.slug}/announcements`;

  const [rows, setRows] = useState<TenantAnnouncement[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [retractTarget, setRetractTarget] = useState<TenantAnnouncement | null>(null);
  const [retracting, setRetracting] = useState(false);
  const [retractError, setRetractError] = useState<string | null>(null);
  const [detail, setDetail] = useState<TenantAnnouncement | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await api<{ data: TenantAnnouncement[] }>('/tenant/announcements');
      setRows(res.data);
    } catch (err) {
      setLoadError(resolveError(err));
    }
  }, [resolveError]);

  useEffect(() => {
    if (canManage) void load();
  }, [canManage, load]);

  async function mutate(id: string, action: () => Promise<unknown>) {
    setBusyId(id);
    setRowError(null);
    try {
      await action();
      await load();
    } catch (err) {
      setRowError(resolveError(err));
    } finally {
      setBusyId(null);
    }
  }

  async function doRetract() {
    if (!retractTarget) return;
    setRetracting(true);
    setRetractError(null);
    try {
      await api(`/tenant/announcements/${retractTarget.id}/retract`, { method: 'POST' });
      setRetractTarget(null);
      await load();
    } catch (err) {
      setRetractError(resolveError(err));
    } finally {
      setRetracting(false);
    }
  }

  if (!canManage) {
    return (
      <EmptyState
        icon={<ShieldAlert size={28} />}
        title={t('noPermission.title')}
        hint={t('noPermission.hint')}
      />
    );
  }

  const titleFor = (a: TenantAnnouncement) =>
    (locale === 'ar' ? a.titles.ar : a.titles.en) ?? a.titles.en ?? '';

  const sentTime = (a: TenantAnnouncement) =>
    a.publishedAt
      ? t('list.sentAt', {
          time: formatDate(a.publishedAt, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: timezone,
          }),
        })
      : a.status === 'scheduled' && a.publishAtLocal
        ? t('list.scheduledFor', { time: a.publishAtLocal })
        : null;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">{t('title')}</h1>
          <PageIntro>{g('intro')}</PageIntro>
        </div>
        <Link href={`${base}/compose`}>
          <Button disabled={readOnly} title={readOnly ? t('readOnlyHint') : undefined}>
            {t('list.compose')}
          </Button>
        </Link>
      </div>

      <div className="mt-4">
        <HintCard hintKey="announcements.firstRun" title={g('hint.title')}>
          {g('hint.body')}
        </HintCard>
      </div>

      {rowError ? (
        <p role="alert" className="mt-4 rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {rowError}
        </p>
      ) : null}

      {loadError ? (
        <div className="mt-6">
          <ErrorState message={loadError} onRetry={() => void load()} />
        </div>
      ) : rows === null ? (
        <div className="mt-6 space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={<Megaphone size={28} />}
            title={t('empty.title')}
            hint={t('empty.hint')}
            action={
              <Link href={`${base}/compose`}>
                <Button disabled={readOnly} title={readOnly ? t('readOnlyHint') : undefined}>
                  {t('empty.cta')}
                </Button>
              </Link>
            }
          />
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {rows.map((a) => {
            const time = sentTime(a);
            return (
              <li
                key={a.id}
                className="rounded-xl border border-line bg-white p-4"
                data-testid={`announcement-row-${a.id}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDetail(a)}
                    className="text-start font-medium text-ink underline-offset-2 hover:underline"
                  >
                    {titleFor(a)}
                  </button>
                  {a.priority ? (
                    <span className="rounded-full bg-gold-soft px-2 py-0.5 text-[11px] font-semibold text-ink">
                      {t('compose.priority')}
                    </span>
                  ) : null}
                  <AnnouncementStatusBadge status={a.status} />
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-soft">
                  <span>
                    {audienceSummary(
                      a.audience,
                      (key, values) => t(key, values),
                      a.audienceStay
                        ? `${a.audienceStay.guestName} — ${a.audienceStay.roomNumber}`
                        : null,
                    )}
                  </span>
                  {time ? <span>{time}</span> : null}
                  {a.status !== 'draft' && a.status !== 'scheduled' ? (
                    <span className="inline-flex items-center gap-1">
                      {t('stats.readBy', {
                        reads: a.stats.reads,
                        audience: a.stats.audienceNow,
                      })}
                      <InfoTip label={t('detail.readStats')}>{g('readStats')}</InfoTip>
                    </span>
                  ) : null}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {a.status === 'draft' || a.status === 'scheduled' ? (
                    <>
                      <Link href={`${base}/compose?id=${a.id}`}>
                        <Button
                          variant="ghost"
                          disabled={readOnly || busyId !== null}
                          title={readOnly ? t('readOnlyHint') : undefined}
                        >
                          {t('list.actions.edit')}
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        disabled={readOnly || busyId !== null}
                        title={readOnly ? t('readOnlyHint') : undefined}
                        onClick={() =>
                          void mutate(a.id, () =>
                            api(`/tenant/announcements/${a.id}/send`, { method: 'POST' }),
                          )
                        }
                      >
                        {t('list.actions.send')}
                      </Button>
                    </>
                  ) : null}
                  {a.status === 'scheduled' ? (
                    <Button
                      variant="ghost"
                      disabled={readOnly || busyId !== null}
                      title={readOnly ? t('readOnlyHint') : undefined}
                      onClick={() =>
                        void mutate(a.id, () =>
                          api(`/tenant/announcements/${a.id}/cancel`, { method: 'POST' }),
                        )
                      }
                    >
                      {t('list.actions.cancel')}
                    </Button>
                  ) : null}
                  {a.status === 'live' ? (
                    <Button
                      variant="danger"
                      disabled={readOnly || busyId !== null}
                      title={readOnly ? t('readOnlyHint') : undefined}
                      onClick={() => {
                        setRetractError(null);
                        setRetractTarget(a);
                      }}
                    >
                      {t('list.actions.retract')}
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmModal
        open={retractTarget !== null}
        onClose={() => setRetractTarget(null)}
        title={t('retract.title')}
        confirmLabel={t('retract.confirm')}
        onConfirm={() => void doRetract()}
        destructive
        loading={retracting}
        error={retractError}
      >
        <ConsequenceNote tone="danger">{t('retract.consequence')}</ConsequenceNote>
      </ConfirmModal>

      <AnnouncementDetailModal
        announcement={detail}
        onClose={() => setDetail(null)}
        onRetract={
          detail?.status === 'live' && !readOnly
            ? () => {
                setDetail(null);
                setRetractError(null);
                setRetractTarget(detail);
              }
            : undefined
        }
      />
    </div>
  );
}
