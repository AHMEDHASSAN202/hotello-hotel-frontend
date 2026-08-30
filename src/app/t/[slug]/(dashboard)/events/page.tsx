'use client';

import { CalendarDays, Plus, ShieldAlert, Users } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { EventModal } from '@/components/events/event-modal';
import { EventStatusBadge } from '@/components/events/status-badge';
import { ConfirmModal, ConsequenceNote, PageIntro } from '@/components/guidance';
import { useTenant } from '@/components/tenant-provider';
import { Button, EmptyState, ErrorState, Skeleton } from '@/components/ui';
import { api } from '@/lib/api';
import { useApiError } from '@/lib/errors';
import type {
  EventListTab,
  TenantEventListItem,
  TenantEventsListResponse,
} from '@/lib/types';

const TABS: EventListTab[] = ['upcoming', 'past', 'cancelled'];

/**
 * Epic 21, Story 21.2 AC4 — events management list: upcoming / past /
 * cancelled tabs with booked/capacity counts.
 *
 * Task 14 — publish (non-destructive, "announce to guests" defaulted on) and
 * cancel (destructive, required reason) confirm flows, both reusing the
 * Epic 12 `ConfirmModal`/`ConsequenceNote` kit (the announcements retract /
 * F&B staff-cancel templates). The cancel consequence count reuses the row's
 * already-loaded `bookedCount` (`EventListItemView`, a batch-loaded SUM of
 * active booking party sizes) — the single-event GET the row data came from
 * doesn't return it, only the list endpoint does, so there's nothing fresher
 * to re-fetch right before opening the modal. The create/edit form (Task 13)
 * is wired in below.
 */
export default function EventsPage() {
  const t = useTranslations('events');
  const g = useTranslations('guidance.events');
  const locale = useLocale();
  const resolveError = useApiError();
  const params = useParams<{ slug: string }>();
  const { hasPermission, readOnly } = useTenant();

  const canRead = hasPermission('events.read');
  const canManage = hasPermission('events.manage');

  const [tab, setTab] = useState<EventListTab>('upcoming');
  const [rows, setRows] = useState<TenantEventListItem[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Task 13 — modal state: open + which event (null = create mode).
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<TenantEventListItem | null>(
    null,
  );

  // Task 14 — publish confirm flow.
  const [publishTarget, setPublishTarget] =
    useState<TenantEventListItem | null>(null);
  const [announce, setAnnounce] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  // Task 14 — cancel confirm flow.
  const [cancelTarget, setCancelTarget] =
    useState<TenantEventListItem | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await api<TenantEventsListResponse>(
        `/tenant/events?tab=${tab}`,
      );
      setRows(res.data);
    } catch (err) {
      setLoadError(resolveError(err));
    }
  }, [tab, resolveError]);

  useEffect(() => {
    if (canRead) void load();
  }, [canRead, load]);

  async function doPublish() {
    if (!publishTarget) return;
    setPublishing(true);
    setPublishError(null);
    try {
      await api(`/tenant/events/${publishTarget.id}/publish`, {
        method: 'POST',
        body: JSON.stringify({ announce }),
      });
      setPublishTarget(null);
      await load();
    } catch (err) {
      setPublishError(resolveError(err));
    } finally {
      setPublishing(false);
    }
  }

  async function doCancel() {
    if (!cancelTarget) return;
    if (!cancelReason.trim()) {
      setCancelError(t('cancel.reasonRequired'));
      return;
    }
    setCancelling(true);
    setCancelError(null);
    try {
      await api(`/tenant/events/${cancelTarget.id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: cancelReason.trim() }),
      });
      setCancelTarget(null);
      await load();
    } catch (err) {
      setCancelError(resolveError(err));
    } finally {
      setCancelling(false);
    }
  }

  if (!canRead) {
    return (
      <EmptyState
        icon={<ShieldAlert size={28} />}
        title={t('noAccess.title')}
        hint={t('noAccess.hint')}
      />
    );
  }

  const titleFor = (e: TenantEventListItem) =>
    (locale === 'ar' ? e.titles.ar : e.titles.en) ?? e.titles.en ?? '';

  const switchTab = (next: EventListTab) => {
    if (next === tab) return;
    setTab(next);
    setRows(null);
  };

  const tabClass = (v: EventListTab) =>
    `flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
      tab === v ? 'bg-ink text-white' : 'bg-paper text-ink-soft hover:text-ink'
    }`;

  const createButton = (
    <Button
      disabled={readOnly}
      title={readOnly ? t('readOnlyHint') : undefined}
      onClick={() => {
        setEditingEvent(null);
        setModalOpen(true);
      }}
    >
      <Plus size={16} aria-hidden /> {t('list.createEvent')}
    </Button>
  );

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-gold">
            {t('eyebrow')}
          </p>
          <h1 className="mt-1 font-display text-2xl font-semibold text-ink">
            {t('title')}
          </h1>
          <PageIntro>{g('intro')}</PageIntro>
        </div>
        {canManage && createButton}
      </div>

      {/* Upcoming / past / cancelled tabs — the app's aria-pressed pill pattern. */}
      <div className="mt-6 flex max-w-md gap-2 rounded-lg border border-line p-1">
        {TABS.map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={tab === v}
            className={tabClass(v)}
            onClick={() => switchTab(v)}
          >
            {t(`list.tabs.${v}`)}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {loadError ? (
          <ErrorState message={loadError} onRetry={() => void load()} />
        ) : rows === null ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : rows.length === 0 ? (
          tab === 'upcoming' ? (
            // Genuinely empty (never created an event) — full onboarding empty
            // state with the create CTA, distinct from the categorical case below.
            <EmptyState
              icon={<CalendarDays size={28} />}
              title={t('list.empty.upcomingTitle')}
              hint={t('list.empty.upcomingHint')}
              action={canManage ? createButton : undefined}
            />
          ) : (
            // A specific tab with nothing in it (past/cancelled) — not a
            // first-run state, so no CTA.
            <EmptyState
              icon={<CalendarDays size={28} />}
              title={t(`list.empty.${tab}Title`)}
              hint={t(`list.empty.${tab}Hint`)}
            />
          )
        ) : (
          <ul className="space-y-3">
            {rows.map((ev) => (
              <li
                key={ev.id}
                className="rounded-xl border border-line bg-white p-4"
                data-testid={`event-row-${ev.id}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-ink">{titleFor(ev)}</span>
                  <EventStatusBadge status={ev.status} />
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-soft">
                  <span>{t('list.start', { time: ev.startAtLocal })}</span>
                  <span>
                    {ev.capacity === null
                      ? t('list.capacity.unlimited', { booked: ev.bookedCount })
                      : t('list.capacity.bounded', {
                          booked: ev.bookedCount,
                          capacity: ev.capacity,
                        })}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {ev.status !== 'draft' ? (
                    // Story 21.6 AC1 — drill into the read-only attendee list +
                    // live totals. Never shown for drafts: they can't have
                    // bookings until published.
                    <Link
                      href={`/t/${params.slug}/events/${ev.id}/attendees`}
                      data-testid={`event-attendees-link-${ev.id}`}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-transparent px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-ink"
                    >
                      <Users size={14} aria-hidden />
                      {t('list.actions.attendees')}
                    </Link>
                  ) : null}
                  {canManage &&
                  (ev.status === 'draft' || ev.status === 'published') ? (
                    <>
                      <Button
                        variant="ghost"
                        disabled={readOnly}
                        title={readOnly ? t('readOnlyHint') : undefined}
                        onClick={() => {
                          setEditingEvent(ev);
                          setModalOpen(true);
                        }}
                      >
                        {t('list.actions.edit')}
                      </Button>
                      {ev.status === 'draft' ? (
                        <Button
                          variant="ghost"
                          disabled={readOnly}
                          title={readOnly ? t('readOnlyHint') : undefined}
                          onClick={() => {
                            setAnnounce(true);
                            setPublishError(null);
                            setPublishTarget(ev);
                          }}
                        >
                          {t('list.actions.publish')}
                        </Button>
                      ) : (
                        <Button
                          variant="danger"
                          disabled={readOnly}
                          title={readOnly ? t('readOnlyHint') : undefined}
                          onClick={() => {
                            setCancelReason('');
                            setCancelError(null);
                            setCancelTarget(ev);
                          }}
                        >
                          {t('list.actions.cancel')}
                        </Button>
                      )}
                    </>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <EventModal
        event={editingEvent}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={() => void load()}
      />

      <ConfirmModal
        open={publishTarget !== null}
        onClose={() => setPublishTarget(null)}
        title={t('publish.title')}
        confirmLabel={t('publish.confirm')}
        onConfirm={() => void doPublish()}
        loading={publishing}
        error={publishError}
      >
        <p className="text-sm text-ink-soft">{t('publish.body')}</p>
        <label className="flex items-center gap-2 text-sm font-medium text-ink">
          <input
            type="checkbox"
            checked={announce}
            onChange={(e) => setAnnounce(e.target.checked)}
          />
          {t('publish.announceLabel')}
        </label>
      </ConfirmModal>

      <ConfirmModal
        open={cancelTarget !== null}
        onClose={() => setCancelTarget(null)}
        title={t('cancel.title')}
        confirmLabel={t('cancel.confirm')}
        onConfirm={() => void doCancel()}
        destructive
        loading={cancelling}
        error={cancelError}
      >
        <ConsequenceNote tone="danger">
          {cancelTarget
            ? t('cancel.consequence', { count: cancelTarget.bookedCount })
            : null}
        </ConsequenceNote>
        <label className="mt-3 block">
          <span className="mb-1 block text-sm font-medium text-ink">
            {t('cancel.reasonLabel')} <span className="text-danger">*</span>
          </span>
          <textarea
            className="w-full rounded-lg border border-line p-2 text-sm"
            rows={3}
            maxLength={500}
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
          />
        </label>
      </ConfirmModal>
    </div>
  );
}
