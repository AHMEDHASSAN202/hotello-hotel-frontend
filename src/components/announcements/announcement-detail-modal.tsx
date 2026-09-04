'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { audienceSummary } from '@/components/announcements/audience-summary';
import { AnnouncementStatusBadge } from '@/components/announcements/status-badge';
import { InfoTip } from '@/components/guidance';
import { useTenant } from '@/components/tenant-provider';
import { Button, Modal } from '@/components/ui';
import { useFormatters } from '@/i18n/use-format';
import { GUEST_LANGUAGES, type GuestLanguage, type TenantAnnouncement } from '@/lib/types';

/**
 * 19.3 AC2 — the announcement detail: full content per language tab, the
 * audience filter, the created → published → retracted/expired timeline and
 * the aggregate read count. Deliberately NO per-guest read list (AC3).
 */
export function AnnouncementDetailModal({
  announcement,
  onClose,
  onRetract,
}: {
  announcement: TenantAnnouncement | null;
  onClose: () => void;
  onRetract?: () => void;
}) {
  const t = useTranslations('announcements');
  const g = useTranslations('guidance.announcements');
  const { me } = useTenant();
  const { formatDate } = useFormatters();
  const timezone = me?.hotel.timezone ?? 'Africa/Cairo';
  const [lang, setLang] = useState<GuestLanguage>('en');

  useEffect(() => {
    if (announcement) setLang('en');
  }, [announcement]);

  if (!announcement) return null;
  const a = announcement;

  const stamp = (value: string) =>
    formatDate(value, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: timezone,
    });

  const timeline: Array<{ key: string; value: string }> = [
    { key: 'created', value: stamp(a.createdAt) },
    ...(a.status === 'scheduled' && a.publishAtLocal
      ? [{ key: 'scheduled', value: a.publishAtLocal }]
      : []),
    ...(a.publishedAt ? [{ key: 'published', value: stamp(a.publishedAt) }] : []),
    ...(a.retractedAt ? [{ key: 'retracted', value: stamp(a.retractedAt) }] : []),
    ...(a.expiredAt ? [{ key: 'expired', value: stamp(a.expiredAt) }] : []),
    ...(a.activeUntilLocal && !a.expiredAt
      ? [{ key: 'activeUntil', value: a.activeUntilLocal }]
      : []),
  ];

  const title = a.titles[lang];
  const body = a.bodies[lang];

  /**
   * 23.3 AC5 — a third stats cell for device-delivery counts. The backend
   * OMITS `stats.push` entirely (never zero-fills it) for rows that don't
   * qualify (push off, or nothing dispatched yet) — so presence of the key
   * is the "has stats" signal, not `sendPush` alone. Not-yet-dispatched
   * `sendPush` rows (draft/scheduled) get a "planned" line instead; every
   * other combination (push off, or a stray sendPush row with no stats and
   * no draft/scheduled status) renders nothing.
   */
  const pushStats = a.stats.push;
  const pushPlanned = !pushStats && a.sendPush && (a.status === 'draft' || a.status === 'scheduled');

  return (
    <Modal open onClose={onClose} title={t('detail.languages')} wide>
      <div className="flex flex-wrap items-center gap-2">
        <AnnouncementStatusBadge status={a.status} />
        {a.priority ? (
          <span className="rounded-full bg-gold-soft px-2 py-0.5 text-[11px] font-semibold text-ink">
            {t('compose.priority')}
          </span>
        ) : null}
      </div>

      <div role="tablist" aria-label={t('detail.languages')} className="mt-4 flex flex-wrap gap-1.5">
        {GUEST_LANGUAGES.map((code) => {
          const filled = Boolean(a.titles[code] || a.bodies[code]);
          return (
            <button
              key={code}
              role="tab"
              aria-selected={lang === code}
              disabled={!filled}
              onClick={() => setLang(code)}
              className={`rounded-full border px-2.5 py-1 text-xs font-semibold uppercase transition-colors disabled:opacity-40 ${
                lang === code
                  ? 'border-ink bg-ink text-white'
                  : 'border-line bg-white text-ink-soft'
              }`}
            >
              {code}
            </button>
          );
        })}
      </div>

      <div className="mt-3 rounded-lg border border-line bg-paper p-4" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        {title || body ? (
          <>
            <h3 className="font-medium text-ink">{title ?? ''}</h3>
            <div className="mt-2 space-y-2">
              {(body ?? '').split(/\n{2,}/).map((paragraph, i) => (
                <p key={i} className="text-sm leading-relaxed text-ink-soft">
                  {paragraph}
                </p>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-ink-soft">{t('detail.emptyLocale')}</p>
        )}
      </div>

      <dl className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-ink-soft">
            {t('detail.audience')}
          </dt>
          <dd className="mt-1 text-sm text-ink">
            {audienceSummary(
              a.audience,
              (key, values) => t(key, values),
              a.audienceStay
                ? `${a.audienceStay.guestName} — ${a.audienceStay.roomNumber}`
                : null,
            )}
          </dd>
        </div>
        <div>
          <dt className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-ink-soft">
            {t('detail.readStats')}
            <InfoTip label={t('detail.readStats')}>{g('readStats')}</InfoTip>
          </dt>
          <dd className="mt-1 text-sm text-ink">
            {t('stats.readBy', { reads: a.stats.reads, audience: a.stats.audienceNow })}
          </dd>
        </div>
        {pushStats || pushPlanned ? (
          <div>
            <dt className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-ink-soft">
              {t('detail.pushStats')}
              <InfoTip label={t('detail.pushStats')}>{g('pushStats')}</InfoTip>
            </dt>
            <dd className="mt-1 text-sm text-ink">
              {pushStats ? (
                <>
                  {t('stats.pushDelivered', { sent: pushStats.sent })}
                  {pushStats.failed > 0 ? (
                    <span className="text-danger">
                      {' '}
                      {t('stats.pushFailures', { failed: pushStats.failed })}
                    </span>
                  ) : null}
                </>
              ) : (
                t('detail.pushPlanned')
              )}
            </dd>
          </div>
        ) : null}
      </dl>

      <div className="mt-5">
        <h4 className="text-xs font-medium uppercase tracking-wide text-ink-soft">
          {t('detail.timeline')}
        </h4>
        <ul className="mt-2 space-y-1.5">
          {timeline.map((entry) => (
            <li key={entry.key} className="flex items-baseline gap-2 text-sm">
              <span className="min-w-24 font-medium text-ink">
                {t(`detail.${entry.key}`)}
              </span>
              <span className="text-ink-soft">{entry.value}</span>
            </li>
          ))}
        </ul>
      </div>

      {onRetract ? (
        <div className="mt-6 flex justify-end">
          <Button variant="danger" onClick={onRetract}>
            {t('list.actions.retract')}
          </Button>
        </div>
      ) : null}
    </Modal>
  );
}
