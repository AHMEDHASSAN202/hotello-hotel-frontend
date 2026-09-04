'use client';

import { ArrowLeft, ShieldAlert } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  AnnouncementContentFields,
  contentComplete,
  contentToFields,
  contentToPayload,
  type AnnouncementContentValues,
} from '@/components/announcements/announcement-content-fields';
import { AudienceBuilder } from '@/components/announcements/audience-builder';
import {
  EMPTY_SCHEDULE,
  ScheduleFields,
  scheduleComplete,
  scheduleToPayload,
  stampToParts,
  type ScheduleValue,
} from '@/components/announcements/schedule-fields';
import { ConfirmModal, InfoTip, RequiredNote } from '@/components/guidance';
import { useTenant } from '@/components/tenant-provider';
import { Button, EmptyState, Skeleton, selectClass } from '@/components/ui';
import { api } from '@/lib/api';
import { useApiError } from '@/lib/errors';
import type {
  AudienceFilter,
  HotelInfoOverview,
  InfoEntryManage,
  TenantAnnouncement,
} from '@/lib/types';

/** 23.3 — 'HH:MM' → minutes since midnight, for pure quiet-hours math. */
function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Is `time` inside the hotel's quiet-hours window `[start, end)`? Handles
 * the midnight-crossing case (e.g. 22:00–08:00, `start > end`) with pure
 * minute math — no Date arithmetic. The boundary is inclusive at `start`,
 * exclusive at `end`: a send landing exactly at `end` counts as "quiet
 * hours are already over", matching how the window is described to staff
 * ("ends at 08:00").
 */
function isInQuietHours(time: string, start: string, end: string): boolean {
  const t = minutesOf(time);
  const s = minutesOf(start);
  const e = minutesOf(end);
  if (s === e) return false;
  return s < e ? t >= s && t < e : t >= s || t < e;
}

/** Current hotel-local 'HH:MM', for the send-now quiet-hours check. */
function currentHotelTime(timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  const hour = parts.find((p) => p.type === 'hour')?.value ?? '00';
  const minute = parts.find((p) => p.type === 'minute')?.value ?? '00';
  return `${hour}:${minute}`;
}

/**
 * Epic 19, Story 19.1/19.2 — the compose page: 7-language content, optional
 * Hotel Info link, priority flag (with the "use sparingly" nudge, spec note
 * 7), the audience builder with its live count, and send-now/schedule
 * timing. `?id=` opens draft/scheduled announcements for editing (live ones
 * are never editable — 19.2 AC3).
 *
 * 23.3 AC1/AC4 — a `sendPush` toggle decides whether the announcement also
 * wakes guests' locked phones. It defaults to following `priority` until the
 * operator explicitly touches it (the `sendPushTouched` dirty flag below) so
 * an operator who deliberately unticks push never gets it silently
 * re-enabled by a later priority toggle. AC4's quiet-hours hint warns when
 * the effective send moment falls inside `me.hotel.pushQuietHours` and the
 * notice isn't priority (priority pushes skip quiet hours entirely).
 */
export default function ComposeAnnouncementPage() {
  const t = useTranslations('announcements');
  const g = useTranslations('guidance.announcements');
  const locale = useLocale();
  const router = useRouter();
  const params = useParams<{ slug: string }>();
  const search = useSearchParams();
  const editId = search.get('id');
  const { hasPermission, readOnly, me } = useTenant();
  const resolveError = useApiError();
  const canManage = hasPermission('announcements.manage');
  const base = `/t/${params.slug}/announcements`;

  const [values, setValues] = useState<AnnouncementContentValues>(() => contentToFields());
  const [audience, setAudience] = useState<AudienceFilter>({});
  const [stayLabel, setStayLabel] = useState<string | null>(null);
  const [priority, setPriority] = useState(false);
  const [sendPush, setSendPush] = useState(false);
  const [sendPushTouched, setSendPushTouched] = useState(false);
  const [infoEntryId, setInfoEntryId] = useState('');
  const [schedule, setSchedule] = useState<ScheduleValue>(EMPTY_SCHEDULE);
  const [loadingEdit, setLoadingEdit] = useState(Boolean(editId));
  const [infoEntries, setInfoEntries] = useState<InfoEntryManage[]>([]);
  const [livePriorityExists, setLivePriorityExists] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [nudgeOpen, setNudgeOpen] = useState(false);

  // Hotel Info link options (silently absent if that module is off).
  useEffect(() => {
    void api<HotelInfoOverview>('/tenant/hotel-info')
      .then((overview) =>
        setInfoEntries(
          [...overview.facilities, ...overview.services, ...overview.houseRules].filter(
            (entry) => entry.isActive,
          ),
        ),
      )
      .catch(() => setInfoEntries([]));
  }, []);

  // Priority nudge input (spec note 7): is another priority announcement live?
  useEffect(() => {
    void api<{ data: TenantAnnouncement[] }>('/tenant/announcements')
      .then((res) =>
        setLivePriorityExists(
          res.data.some((a) => a.status === 'live' && a.priority && a.id !== editId),
        ),
      )
      .catch(() => setLivePriorityExists(false));
  }, [editId]);

  // 23.3 AC1 — sendPush defaults to following priority until the operator
  // explicitly touches the toggle (see the class doc comment above).
  useEffect(() => {
    if (!sendPushTouched) setSendPush(priority);
  }, [priority, sendPushTouched]);

  // Edit mode — only draft/scheduled land here; anything else goes back.
  useEffect(() => {
    if (!editId) return;
    let cancelled = false;
    void api<TenantAnnouncement>(`/tenant/announcements/${editId}`)
      .then((a) => {
        if (cancelled) return;
        if (a.status !== 'draft' && a.status !== 'scheduled') {
          router.replace(base);
          return;
        }
        setValues(contentToFields(a));
        setAudience(a.audience);
        setStayLabel(
          a.audienceStay ? `${a.audienceStay.guestName} — ${a.audienceStay.roomNumber}` : null,
        );
        setPriority(a.priority);
        // The stored value is already the operator's explicit choice — mark
        // it touched so the priority-follow effect above never overrides it.
        setSendPush(a.sendPush);
        setSendPushTouched(true);
        setInfoEntryId(a.infoEntryId ?? '');
        const publish = stampToParts(a.publishAtLocal);
        const until = stampToParts(a.activeUntilLocal);
        setSchedule({
          mode: a.status === 'scheduled' ? 'schedule' : 'now',
          publishDate: publish.date,
          publishTime: publish.time,
          untilDate: until.date,
          untilTime: until.time,
        });
        setLoadingEdit(false);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(resolveError(err));
          setLoadingEdit(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [editId, base, router, resolveError]);

  const submit = useCallback(async () => {
    setSubmitting(true);
    setError(null);
    try {
      const timing = scheduleToPayload(schedule);
      const content = {
        ...contentToPayload(values),
        infoEntryId: infoEntryId || (editId ? null : undefined),
        priority,
        sendPush,
        audience,
        ...timing,
        // Edits must explicitly clear a removed active-until window.
        ...(editId && !timing.activeUntilLocal ? { activeUntilLocal: null } : {}),
      };
      if (editId) {
        await api(`/tenant/announcements/${editId}`, {
          method: 'PATCH',
          body: JSON.stringify(content),
        });
      } else {
        await api('/tenant/announcements', {
          method: 'POST',
          body: JSON.stringify({
            ...content,
            action: schedule.mode === 'schedule' ? 'schedule' : 'send',
          }),
        });
      }
      router.push(base);
    } catch (err) {
      setError(resolveError(err));
      setSubmitting(false);
    }
  }, [
    values,
    infoEntryId,
    priority,
    sendPush,
    audience,
    schedule,
    editId,
    base,
    router,
    resolveError,
  ]);

  function onSubmitClick() {
    // Spec note 7 — soft nudge before stacking a second live priority notice.
    if (priority && livePriorityExists) {
      setNudgeOpen(true);
      return;
    }
    void submit();
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

  const entryName = (entry: InfoEntryManage) =>
    (locale === 'ar' ? entry.names.ar : entry.names.en) ?? entry.names.en ?? '';

  const canSubmit =
    contentComplete(values) && scheduleComplete(schedule) && !readOnly && !submitting;

  const submitLabel = editId
    ? t('compose.submitSave')
    : schedule.mode === 'schedule'
      ? t('compose.submitSchedule')
      : t('compose.submitSend');

  // 23.3 AC4 — the quiet-hours hint. Priority notices skip quiet hours
  // entirely, so it only applies to a non-priority push. `mode: 'schedule'`
  // uses the naked hotel-local publishTime as-is (house rule: never
  // `toISOString()` it); `mode: 'now'` computes the current hotel-local
  // clock via Intl with the hotel's IANA timezone.
  const quietHours = me?.hotel.pushQuietHours;
  const effectiveSendTime =
    schedule.mode === 'schedule'
      ? schedule.publishTime
      : me?.hotel.timezone
        ? currentHotelTime(me.hotel.timezone)
        : '';
  const showQuietHoursHint =
    sendPush &&
    !priority &&
    Boolean(quietHours) &&
    Boolean(effectiveSendTime) &&
    isInQuietHours(effectiveSendTime, quietHours!.start, quietHours!.end);

  return (
    <div className="max-w-3xl">
      <Link
        href={base}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft underline-offset-2 hover:underline"
      >
        <ArrowLeft size={16} className="rtl:-scale-x-100" aria-hidden />
        {t('compose.back')}
      </Link>
      <h1 className="mt-2 font-display text-2xl font-semibold text-ink">
        {editId ? t('compose.editTitle') : t('compose.title')}
      </h1>

      {loadingEdit ? (
        <div className="mt-6 space-y-3">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <form
          className="mt-6 space-y-8"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmitClick();
          }}
        >
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-soft">
              {t('compose.contentTitle')}
            </h2>
            <AnnouncementContentFields
              values={values}
              onChange={(key, value) => setValues((s) => ({ ...s, [key]: value }))}
              disabled={readOnly || submitting}
            />
            <RequiredNote />

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 flex items-center gap-1.5 text-sm font-medium text-ink">
                  {t('compose.infoLink')}
                  <InfoTip label={t('compose.infoLink')}>{g('infoLink')}</InfoTip>
                </span>
                <select
                  className={selectClass}
                  disabled={readOnly || submitting || infoEntries.length === 0}
                  value={infoEntryId}
                  onChange={(e) => setInfoEntryId(e.target.value)}
                >
                  <option value="">{t('compose.infoLinkNone')}</option>
                  {infoEntries.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entryName(entry)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex items-center gap-2 self-end pb-2 text-sm font-medium text-ink">
                <input
                  type="checkbox"
                  disabled={readOnly || submitting}
                  checked={priority}
                  onChange={(e) => setPriority(e.target.checked)}
                />
                {t('compose.priority')}
                <InfoTip label={t('compose.priority')}>{g('priority')}</InfoTip>
              </label>

              <div>
                <label className="flex items-center gap-2 pb-2 text-sm font-medium text-ink">
                  <input
                    type="checkbox"
                    disabled={readOnly || submitting}
                    checked={sendPush}
                    onChange={(e) => {
                      setSendPush(e.target.checked);
                      setSendPushTouched(true);
                    }}
                  />
                  {t('compose.sendPush')}
                  <InfoTip label={t('compose.sendPush')}>{g('sendPush')}</InfoTip>
                </label>
                {showQuietHoursHint ? (
                  <p className="mt-1 text-xs text-ink-soft">
                    {t('compose.quietHoursHint', {
                      start: quietHours!.start,
                      end: quietHours!.end,
                    })}
                  </p>
                ) : null}
              </div>
            </div>
          </section>

          <section>
            <AudienceBuilder
              value={audience}
              onChange={setAudience}
              disabled={readOnly || submitting}
              stayLabel={stayLabel}
            />
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-soft">
              {t('compose.timingTitle')}
            </h2>
            <ScheduleFields
              value={schedule}
              onChange={setSchedule}
              disabled={readOnly || submitting}
            />
          </section>

          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}

          <div className="flex items-center gap-3">
            <Button
              type="submit"
              loading={submitting}
              disabled={!canSubmit}
              title={readOnly ? t('readOnlyHint') : undefined}
            >
              {submitLabel}
            </Button>
            <Link href={base}>
              <Button type="button" variant="ghost" disabled={submitting}>
                {t('compose.back')}
              </Button>
            </Link>
          </div>
        </form>
      )}

      <ConfirmModal
        open={nudgeOpen}
        onClose={() => setNudgeOpen(false)}
        title={t('nudge.title')}
        confirmLabel={t('nudge.confirm')}
        onConfirm={() => {
          setNudgeOpen(false);
          void submit();
        }}
        loading={submitting}
      >
        <p className="text-sm text-ink-soft">{t('nudge.body')}</p>
      </ConfirmModal>
    </div>
  );
}
