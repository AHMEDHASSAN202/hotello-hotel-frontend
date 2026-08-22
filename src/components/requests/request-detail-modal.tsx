'use client';

import { CircleCheck, Play, UserRound, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { ConsequenceNote } from '@/components/guidance';
import { useTenant } from '@/components/tenant-provider';
import { Badge, Bdi, Button, Modal, Skeleton } from '@/components/ui';
import { formatDate } from '@/i18n/format';
import { useFormatters } from '@/i18n/use-format';
import { api } from '@/lib/api';
import { useApiError } from '@/lib/errors';
import {
  STAFF_CANCEL_REASONS,
  type RequestAssignee,
  type StaffCancelReason,
  type TenantRequestDetail,
  type TenantRequestView,
} from '@/lib/types';

type Mode = 'view' | 'cancel' | 'assign';

/**
 * The request drawer (15.5) — one wide modal, mode-switched like
 * StayDetailModal: timeline with actors (times in hotel timezone, AC3),
 * Start / Complete / Cancel-with-reason / Assign, all permission- and
 * readOnly-gated. Mutations bubble the fresh row up via onChanged.
 */
export function RequestDetailModal({
  request,
  onClose,
  onChanged,
}: {
  request: TenantRequestView | null;
  onClose: () => void;
  onChanged: (row: TenantRequestView) => void;
}) {
  const t = useTranslations('requests');
  const tCommon = useTranslations('common');
  const resolveError = useApiError();
  const { locale } = useFormatters();
  const { me, hasPermission, readOnly } = useTenant();
  const canUpdate = hasPermission('requests.update');
  const canAssign = hasPermission('requests.assign');
  const timezone = me?.hotel.timezone ?? 'Africa/Cairo';

  const [detail, setDetail] = useState<TenantRequestDetail | null>(null);
  const [mode, setMode] = useState<Mode>('view');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState<StaffCancelReason>('guest_request');
  const [cancelNote, setCancelNote] = useState('');
  const [assignees, setAssignees] = useState<RequestAssignee[] | null>(null);

  const id = request?.id ?? null;
  useEffect(() => {
    setDetail(null);
    setMode('view');
    setBusy(false);
    setError(null);
    setReason('guest_request');
    setCancelNote('');
    if (!id) return;
    api<TenantRequestDetail>(`/tenant/requests/${id}`)
      .then(setDetail)
      .catch((err) => setError(resolveError(err)));
  }, [id, resolveError]);

  useEffect(() => {
    if (mode !== 'assign' || assignees !== null) return;
    api<RequestAssignee[]>('/tenant/requests/assignees')
      .then(setAssignees)
      .catch((err) => setError(resolveError(err)));
  }, [mode, assignees, resolveError]);

  const run = useCallback(
    async (action: () => Promise<TenantRequestView>) => {
      setBusy(true);
      setError(null);
      try {
        const updated = await action();
        onChanged(updated);
        setDetail((prev) => (prev ? { ...prev, ...updated } : prev));
        setMode('view');
      } catch (err) {
        setError(resolveError(err));
      } finally {
        setBusy(false);
      }
    },
    [onChanged, resolveError],
  );

  if (!request) return null;
  const current = detail ?? request;
  const name = locale === 'ar' ? current.itemNameAr : current.itemNameEn;
  const open = current.status === 'new' || current.status === 'in_progress';
  const hotelTime = (value: string) =>
    formatDate(value, locale, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: timezone,
    });

  const timeline: Array<{
    key: string;
    at: string | null;
    actor?: string | null;
    extra?: string | null;
  }> = [
    {
      key: 'submitted',
      at: current.createdAt,
      extra: detail
        ? t('detail.guestLanguage', {
            language: detail.guestLanguage.toUpperCase(),
          })
        : null,
    },
    ...(current.status === 'cancelled'
      ? [
          {
            key: 'cancelled',
            at: current.cancelledAt,
            actor:
              detail?.cancelledBy?.name ??
              (current.cancelledReason === 'guest' ? t('detail.byGuest') : null),
            extra: current.cancelledReason
              ? t(`cancelReason.${current.cancelledReason}`)
              : null,
          },
        ]
      : [
          {
            key: 'started',
            at: current.startedAt,
            actor: detail?.startedBy?.name ?? null,
          },
          {
            key: 'completed',
            at: current.completedAt,
            actor: detail?.completedBy?.name ?? null,
          },
        ]),
  ];

  return (
    <Modal open onClose={onClose} title={name} wide>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2 text-sm text-ink-soft">
          <Badge
            tone={
              current.status === 'done'
                ? 'success'
                : current.status === 'cancelled'
                  ? 'neutral'
                  : current.status === 'in_progress'
                    ? 'warning'
                    : 'gold'
            }
          >
            {t(`status.${current.status}`)}
          </Badge>
          <span>
            {t('card.room')} <Bdi>{current.roomNumber}</Bdi>
          </span>
          <span>· {current.guestName}</span>
          {current.optionValue ? (
            <span className="tabular-nums">
              ·{' '}
              {current.optionType === 'quantity'
                ? `×${current.optionValue}`
                : current.optionValue}
            </span>
          ) : null}
          {current.assignedTo ? (
            <span className="flex items-center gap-1">
              · <UserRound size={12} aria-hidden /> {current.assignedTo.name}
            </span>
          ) : null}
        </div>

        {current.note ? (
          <div className="rounded-lg bg-paper p-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-soft">
              {t('detail.note')}
              {current.noteLanguage ? (
                <span className="ms-2 rounded bg-line/60 px-1 text-[10px] font-bold uppercase">
                  {current.noteLanguage}
                </span>
              ) : null}
            </p>
            <p className="text-sm text-ink">{current.note}</p>
          </div>
        ) : null}

        {/* Timeline (15.5 AC3) — hotel-timezone timestamps */}
        <ol className="space-y-2 border-s-2 border-line ps-4">
          {timeline.map(({ key, at, actor, extra }) => (
            <li key={key} className="text-sm">
              <span className={at ? 'font-medium text-ink' : 'text-ink-soft/60'}>
                {t(`detail.${key}`)}
              </span>
              {at ? (
                <span className="ms-2 tabular-nums text-ink-soft">
                  {hotelTime(at)}
                </span>
              ) : null}
              {actor ? (
                <span className="ms-2 text-ink-soft">
                  {t('detail.by', { name: actor })}
                </span>
              ) : null}
              {extra ? (
                <span className="ms-2 text-ink-soft">· {extra}</span>
              ) : null}
            </li>
          ))}
          {detail?.cancelNote ? (
            <li className="text-sm text-ink-soft">“{detail.cancelNote}”</li>
          ) : null}
        </ol>

        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
        {!detail && !error ? <Skeleton className="h-5 w-48" /> : null}

        {mode === 'view' && open ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
            {canUpdate && current.status === 'new' ? (
              <Button
                onClick={() =>
                  run(() =>
                    api<TenantRequestView>(
                      `/tenant/requests/${current.id}/start`,
                      { method: 'POST' },
                    ),
                  )
                }
                loading={busy}
                disabled={readOnly}
                title={readOnly ? t('readOnlyHint') : undefined}
              >
                <Play size={14} aria-hidden /> {t('actions.start')}
              </Button>
            ) : null}
            {canUpdate && current.status === 'in_progress' ? (
              <Button
                onClick={() =>
                  run(() =>
                    api<TenantRequestView>(
                      `/tenant/requests/${current.id}/complete`,
                      { method: 'POST' },
                    ),
                  )
                }
                loading={busy}
                disabled={readOnly}
                title={readOnly ? t('readOnlyHint') : undefined}
              >
                <CircleCheck size={14} aria-hidden /> {t('actions.complete')}
              </Button>
            ) : null}
            {canAssign ? (
              <Button
                variant="ghost"
                onClick={() => setMode('assign')}
                disabled={readOnly}
                title={readOnly ? t('readOnlyHint') : undefined}
              >
                <UserRound size={14} aria-hidden /> {t('actions.assign')}
              </Button>
            ) : null}
            {canUpdate ? (
              <Button
                variant="ghost"
                onClick={() => setMode('cancel')}
                disabled={readOnly}
                title={readOnly ? t('readOnlyHint') : undefined}
                className="text-danger"
              >
                <X size={14} aria-hidden /> {t('actions.cancel')}
              </Button>
            ) : null}
          </div>
        ) : null}

        {mode === 'cancel' ? (
          <div className="space-y-3 border-t border-line pt-4">
            <p className="text-sm font-medium text-ink">
              {t('cancelForm.title')}
            </p>
            <div className="space-y-1.5">
              {STAFF_CANCEL_REASONS.map((value) => (
                <label key={value} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="cancel-reason"
                    checked={reason === value}
                    onChange={() => setReason(value)}
                  />
                  {t(`cancelReason.${value}`)}
                </label>
              ))}
            </div>
            {reason === 'other' ? (
              <textarea
                value={cancelNote}
                onChange={(e) => setCancelNote(e.target.value.slice(0, 500))}
                placeholder={t('cancelForm.notePlaceholder')}
                rows={2}
                className="w-full rounded-lg border border-line p-2 text-sm"
              />
            ) : null}
            <ConsequenceNote tone="danger">
              {t('cancelForm.consequence')}
            </ConsequenceNote>
            <div className="flex gap-2">
              <Button
                variant="danger"
                loading={busy}
                disabled={reason === 'other' && !cancelNote.trim()}
                onClick={() =>
                  run(() =>
                    api<TenantRequestView>(
                      `/tenant/requests/${current.id}/cancel`,
                      {
                        method: 'POST',
                        body: JSON.stringify({
                          reason,
                          ...(cancelNote.trim()
                            ? { note: cancelNote.trim() }
                            : {}),
                        }),
                      },
                    ),
                  )
                }
              >
                {t('cancelForm.confirm')}
              </Button>
              <Button variant="ghost" onClick={() => setMode('view')}>
                {tCommon('actions.cancel')}
              </Button>
            </div>
          </div>
        ) : null}

        {mode === 'assign' ? (
          <div className="space-y-3 border-t border-line pt-4">
            <p className="text-sm font-medium text-ink">
              {t('assignForm.title')}
            </p>
            {assignees === null ? (
              <Skeleton className="h-16 w-full" />
            ) : (
              <div className="max-h-56 space-y-1 overflow-y-auto">
                {assignees.map((assignee) => (
                  <button
                    key={assignee.id}
                    disabled={busy}
                    aria-pressed={current.assignedTo?.id === assignee.id}
                    onClick={() =>
                      run(() =>
                        api<TenantRequestView>(
                          `/tenant/requests/${current.id}/assign`,
                          {
                            method: 'POST',
                            body: JSON.stringify({ assigneeId: assignee.id }),
                          },
                        ),
                      )
                    }
                    className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-start text-sm transition-colors ${
                      current.assignedTo?.id === assignee.id
                        ? 'border-gold bg-gold-soft'
                        : 'border-line hover:border-ink'
                    }`}
                  >
                    <span className="font-medium text-ink">{assignee.name}</span>
                    <span className="text-xs text-ink-soft">
                      {locale === 'ar' ? assignee.roleNameAr : assignee.roleNameEn}
                    </span>
                  </button>
                ))}
                {assignees.length === 0 ? (
                  <p className="text-sm text-ink-soft">
                    {t('assignForm.empty')}
                  </p>
                ) : null}
              </div>
            )}
            <div className="flex gap-2">
              {current.assignedTo ? (
                <Button
                  variant="ghost"
                  loading={busy}
                  onClick={() =>
                    run(() =>
                      api<TenantRequestView>(
                        `/tenant/requests/${current.id}/assign`,
                        {
                          method: 'POST',
                          body: JSON.stringify({ assigneeId: null }),
                        },
                      ),
                    )
                  }
                >
                  {t('assignForm.unassign')}
                </Button>
              ) : null}
              <Button variant="ghost" onClick={() => setMode('view')}>
                {tCommon('actions.cancel')}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
