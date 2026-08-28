'use client';

import {
  CircleCheck,
  MoonStar,
  OctagonPause,
  Play,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { InfoTip } from '@/components/guidance';
import { useTenant } from '@/components/tenant-provider';
import { Badge, Bdi, Button, Modal, Skeleton } from '@/components/ui';
import { formatDate } from '@/i18n/format';
import { useFormatters } from '@/i18n/use-format';
import { api } from '@/lib/api';
import { useApiError } from '@/lib/errors';
import type {
  CleaningType,
  HousekeepingAssignee,
  HousekeepingRoomView,
} from '@/lib/types';

type Mode = 'view' | 'flag' | 'interrupt' | 'assign';

const INTERRUPT_REASON_MAX = 500;

/**
 * The room action modal (20.3) — mode-switched like RequestDetailModal:
 * Start / Done / Clear / Flag-with-type / Interrupted-with-reason / Assign,
 * all permission- and readOnly-gated. A DND room explains itself and blocks
 * Start (20.4 AC2). Mutations bubble the fresh row up via onChanged.
 */
export function RoomActionModal({
  room,
  onClose,
  onChanged,
}: {
  room: HousekeepingRoomView | null;
  onClose: () => void;
  onChanged: (row: HousekeepingRoomView) => void;
}) {
  const t = useTranslations('housekeeping');
  const tG = useTranslations('guidance.housekeeping');
  const tCommon = useTranslations('common');
  const resolveError = useApiError();
  const { locale } = useFormatters();
  const { me, hasPermission, readOnly } = useTenant();
  const canUpdate = hasPermission('housekeeping.update');
  const canAssign = hasPermission('housekeeping.assign');
  const timezone = me?.hotel.timezone ?? 'Africa/Cairo';

  const [override, setOverride] = useState<HousekeepingRoomView | null>(null);
  const [mode, setMode] = useState<Mode>('view');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flagType, setFlagType] = useState<CleaningType>('daily');
  const [flagReason, setFlagReason] = useState('');
  const [interruptReason, setInterruptReason] = useState('');
  const [assignees, setAssignees] = useState<HousekeepingAssignee[] | null>(
    null,
  );

  const id = room?.id ?? null;
  useEffect(() => {
    setOverride(null);
    setMode('view');
    setBusy(false);
    setError(null);
    setFlagType('daily');
    setFlagReason('');
    setInterruptReason('');
  }, [id]);

  useEffect(() => {
    if (mode !== 'assign' || assignees !== null) return;
    api<HousekeepingAssignee[]>('/tenant/housekeeping/assignees')
      .then(setAssignees)
      .catch((err) => setError(resolveError(err)));
  }, [mode, assignees, resolveError]);

  const run = useCallback(
    async (action: () => Promise<HousekeepingRoomView>) => {
      setBusy(true);
      setError(null);
      try {
        const updated = await action();
        onChanged(updated);
        setOverride(updated);
        setMode('view');
      } catch (err) {
        setError(resolveError(err));
      } finally {
        setBusy(false);
      }
    },
    [onChanged, resolveError],
  );

  if (!room) return null;
  const current = override ?? room;
  const status = current.housekeepingStatus;
  const hotelTime = (value: string) =>
    formatDate(value, locale, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: timezone,
    });

  const readOnlyTitle = readOnly ? t('readOnlyHint') : undefined;

  return (
    <Modal
      open
      onClose={onClose}
      title={t('modal.title', { room: current.roomNumber })}
      wide
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2 text-sm text-ink-soft">
          <Badge
            tone={
              status === 'clean'
                ? 'success'
                : status === 'in_progress'
                  ? 'warning'
                  : status === 'dnd'
                    ? 'neutral'
                    : 'gold'
            }
          >
            {status === 'dnd' ? (
              <MoonStar size={12} aria-hidden className="me-1" />
            ) : null}
            {t(`status.${status}`)}
          </Badge>
          <InfoTip label={t(`status.${status}`)}>
            {tG(`status.${status}`)}
          </InfoTip>
          {current.cleaningType ? (
            <Badge tone={current.cleaningType === 'checkout' ? 'gold' : 'warning'}>
              {t(`type.${current.cleaningType}`)}
            </Badge>
          ) : null}
          {current.roomStatus === 'out_of_service' ? (
            <Badge tone="danger">{t('card.outOfService')}</Badge>
          ) : null}
          <span>
            · {current.occupied ? t('card.occupied') : t('card.vacant')}
          </span>
          {current.floor !== null ? (
            <span>· {t('floor.label', { floor: current.floor })}</span>
          ) : null}
          {current.assignedTo ? (
            <span className="flex items-center gap-1">
              · <UserRound size={12} aria-hidden /> {current.assignedTo.name}
            </span>
          ) : null}
        </div>

        {/* 20.3 AC3 — the room's cleaning memory, in hotel time. */}
        <p className="text-sm text-ink-soft">
          {current.lastCleanedAt ? (
            current.lastCleanedBy ? (
              t('modal.lastCleanedBy', {
                time: hotelTime(current.lastCleanedAt),
                name: current.lastCleanedBy.name,
              })
            ) : (
              t('modal.lastCleaned', {
                time: hotelTime(current.lastCleanedAt),
              })
            )
          ) : (
            t('modal.neverCleaned')
          )}
        </p>

        {status === 'dnd' ? (
          <div className="flex items-start gap-2 rounded-lg bg-paper p-3 text-sm text-ink">
            <MoonStar size={16} aria-hidden className="mt-0.5 shrink-0" />
            <span>{tG('dnd')}</span>
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}

        {mode === 'view' ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
            {canUpdate && (status === 'needs_cleaning' || status === 'dnd') ? (
              <Button
                onClick={() =>
                  run(() =>
                    api<HousekeepingRoomView>(
                      `/tenant/housekeeping/rooms/${current.id}/start`,
                      { method: 'POST' },
                    ),
                  )
                }
                loading={busy}
                // 20.4 AC2 — a DND room can't be started; the button explains why.
                disabled={readOnly || status === 'dnd'}
                title={
                  status === 'dnd' ? t('modal.dndStartBlocked') : readOnlyTitle
                }
              >
                <Play size={14} aria-hidden /> {t('actions.start')}
              </Button>
            ) : null}
            {canUpdate && status === 'in_progress' ? (
              <Button
                onClick={() =>
                  run(() =>
                    api<HousekeepingRoomView>(
                      `/tenant/housekeeping/rooms/${current.id}/complete`,
                      { method: 'POST' },
                    ),
                  )
                }
                loading={busy}
                disabled={readOnly}
                title={readOnlyTitle}
              >
                <CircleCheck size={14} aria-hidden /> {t('actions.done')}
              </Button>
            ) : null}
            {canUpdate && status === 'in_progress' ? (
              <Button
                variant="ghost"
                onClick={() => setMode('interrupt')}
                disabled={readOnly}
                title={readOnlyTitle}
              >
                <OctagonPause size={14} aria-hidden /> {t('actions.interrupt')}
              </Button>
            ) : null}
            {canUpdate && (status === 'clean' || status === 'dnd') ? (
              <Button
                variant={status === 'clean' ? 'primary' : 'ghost'}
                onClick={() => setMode('flag')}
                disabled={readOnly}
                title={readOnlyTitle}
              >
                <Sparkles size={14} aria-hidden /> {t('actions.flag')}
              </Button>
            ) : null}
            {canUpdate && status === 'needs_cleaning' ? (
              <Button
                variant="ghost"
                onClick={() =>
                  run(() =>
                    api<HousekeepingRoomView>(
                      `/tenant/housekeeping/rooms/${current.id}/clear`,
                      { method: 'POST', body: JSON.stringify({}) },
                    ),
                  )
                }
                loading={busy}
                disabled={readOnly}
                title={readOnlyTitle}
              >
                <X size={14} aria-hidden /> {t('actions.clearFlag')}
              </Button>
            ) : null}
            {canAssign ? (
              <Button
                variant="ghost"
                onClick={() => setMode('assign')}
                disabled={readOnly}
                title={readOnlyTitle}
              >
                <UserRound size={14} aria-hidden /> {t('actions.assign')}
              </Button>
            ) : null}
          </div>
        ) : null}

        {mode === 'flag' ? (
          <div className="space-y-3 border-t border-line pt-4">
            <p className="text-sm font-medium text-ink">
              {t('flagForm.title')}
            </p>
            <div className="space-y-1.5">
              {(['checkout', 'daily'] as CleaningType[]).map((value) => (
                <label key={value} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="cleaning-type"
                    checked={flagType === value}
                    onChange={() => setFlagType(value)}
                  />
                  {t(`type.${value}`)}
                  <span className="text-xs text-ink-soft">
                    {t(`flagForm.${value}Hint`)}
                  </span>
                </label>
              ))}
            </div>
            <textarea
              value={flagReason}
              onChange={(e) => setFlagReason(e.target.value.slice(0, 500))}
              placeholder={t('flagForm.reasonPlaceholder')}
              rows={2}
              className="w-full rounded-lg border border-line p-2 text-sm"
            />
            {status === 'dnd' ? (
              <p className="text-xs text-ink-soft">{t('flagForm.parkedHint')}</p>
            ) : null}
            <div className="flex gap-2">
              <Button
                loading={busy}
                onClick={() =>
                  run(() =>
                    api<HousekeepingRoomView>(
                      `/tenant/housekeeping/rooms/${current.id}/flag`,
                      {
                        method: 'POST',
                        body: JSON.stringify({
                          cleaningType: flagType,
                          ...(flagReason.trim()
                            ? { reason: flagReason.trim() }
                            : {}),
                        }),
                      },
                    ),
                  )
                }
              >
                {t('flagForm.confirm')}
              </Button>
              <Button variant="ghost" onClick={() => setMode('view')}>
                {tCommon('actions.cancel')}
              </Button>
            </div>
          </div>
        ) : null}

        {mode === 'interrupt' ? (
          <div className="space-y-3 border-t border-line pt-4">
            <p className="text-sm font-medium text-ink">
              {t('interruptForm.title')}
            </p>
            <textarea
              value={interruptReason}
              onChange={(e) =>
                setInterruptReason(e.target.value.slice(0, INTERRUPT_REASON_MAX))
              }
              placeholder={t('interruptForm.placeholder')}
              rows={2}
              className="w-full rounded-lg border border-line p-2 text-sm"
            />
            <div className="flex gap-2">
              <Button
                loading={busy}
                disabled={!interruptReason.trim()}
                onClick={() =>
                  run(() =>
                    api<HousekeepingRoomView>(
                      `/tenant/housekeeping/rooms/${current.id}/interrupt`,
                      {
                        method: 'POST',
                        body: JSON.stringify({
                          reason: interruptReason.trim(),
                        }),
                      },
                    ),
                  )
                }
              >
                {t('interruptForm.confirm')}
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
                        api<HousekeepingRoomView>(
                          `/tenant/housekeeping/rooms/${current.id}/assign`,
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
                    <span className="font-medium text-ink">
                      <Bdi>{assignee.name}</Bdi>
                    </span>
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
                      api<HousekeepingRoomView>(
                        `/tenant/housekeeping/rooms/${current.id}/assign`,
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
