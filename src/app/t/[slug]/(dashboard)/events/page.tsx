'use client';

import { CalendarDays, Plus, ShieldAlert } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { EventModal } from '@/components/events/event-modal';
import { EventStatusBadge } from '@/components/events/status-badge';
import { PageIntro } from '@/components/guidance';
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
 * The publish/cancel confirm flows (Task 14) don't exist yet — those row
 * actions stay gated, visually complete, inert stubs (see the TODO-commented
 * onClick handlers) rather than throwaway scaffolding that task would just
 * tear out. The create/edit form (Task 13) is wired in below.
 */
export default function EventsPage() {
  const t = useTranslations('events');
  const g = useTranslations('guidance.events');
  const locale = useLocale();
  const resolveError = useApiError();
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
                {canManage &&
                (ev.status === 'draft' || ev.status === 'published') ? (
                  <div className="mt-3 flex flex-wrap gap-2">
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
                          // TODO(Task 14): open the publish confirm flow once it exists.
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
                          // TODO(Task 14): open the cancel confirm flow once it exists.
                        }}
                      >
                        {t('list.actions.cancel')}
                      </Button>
                    )}
                  </div>
                ) : null}
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
    </div>
  );
}
