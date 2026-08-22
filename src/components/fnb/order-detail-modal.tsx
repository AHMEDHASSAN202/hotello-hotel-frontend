'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { ConfirmModal } from '@/components/guidance';
import { useTenant } from '@/components/tenant-provider';
import { Badge, Bdi, Button, Modal, selectClass } from '@/components/ui';
import { useFormatters } from '@/i18n/use-format';
import { api, ApiError } from '@/lib/api';
import { useApiError } from '@/lib/errors';
import type {
  FnbAssignee,
  FnbCancelReason,
  TenantFnbOrder,
} from '@/lib/types';
import { STAFF_FNB_CANCEL_REASONS } from '@/lib/types';
import { destinationLabel, PaymentChip } from './order-card';

/**
 * The kitchen lifecycle drawer (16.7 AC2): Start → Out for delivery →
 * Delivered, staff cancel with reason (note required for "other"), optional
 * assignment via the options endpoint. Buttons follow the transition map;
 * everything disables under readOnly.
 */
export function OrderDetailModal({
  order,
  onClose,
  onChanged,
}: {
  order: TenantFnbOrder | null;
  onClose: () => void;
  onChanged: (row: TenantFnbOrder) => void;
}) {
  const t = useTranslations('fnb');
  const tCommon = useTranslations('common');
  const resolveError = useApiError();
  const { locale, formatCurrency, formatDateTime } = useFormatters();
  const { hasPermission, readOnly } = useTenant();
  const canUpdate = hasPermission('fnb_orders.update');

  const [current, setCurrent] = useState<TenantFnbOrder | null>(order);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assignees, setAssignees] = useState<FnbAssignee[]>([]);
  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] =
    useState<FnbCancelReason>('out_of_stock');
  const [cancelNote, setCancelNote] = useState('');
  const [cancelError, setCancelError] = useState<string | null>(null);

  useEffect(() => {
    setCurrent(order);
    setError(null);
    setCancelling(false);
    setCancelReason('out_of_stock');
    setCancelNote('');
    setCancelError(null);
  }, [order]);

  useEffect(() => {
    if (!order || !canUpdate) return;
    api<FnbAssignee[]>('/tenant/fnb-orders/assignees')
      .then(setAssignees)
      .catch(() => {});
  }, [order, canUpdate]);

  if (!current) return null;

  async function act(path: string, body?: unknown) {
    if (!current) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await api<TenantFnbOrder>(
        `/tenant/fnb-orders/${current.id}/${path}`,
        { method: 'POST', ...(body ? { body: JSON.stringify(body) } : {}) },
      );
      setCurrent(updated);
      onChanged(updated);
      setCancelling(false);
    } catch (err) {
      setError(err instanceof ApiError ? resolveError(err) : resolveError(err));
    } finally {
      setBusy(false);
    }
  }

  const lineName = (line: TenantFnbOrder['lines'][number]) =>
    locale === 'ar' ? line.itemNameAr : line.itemNameEn;
  const optionName = (line: TenantFnbOrder['lines'][number]) =>
    locale === 'ar' ? line.variantOptionNameAr : line.variantOptionNameEn;

  const timeline: Array<[string, string | null]> = [
    ['created', current.createdAt],
    ['startedAt', current.startedAt],
    ['outForDeliveryAt', current.outForDeliveryAt],
    current.status === 'cancelled'
      ? ['cancelledAt', current.cancelledAt]
      : ['deliveredAt', current.deliveredAt],
  ];

  const mutationsDisabled = !canUpdate || readOnly || busy;

  return (
    <Modal open onClose={onClose} title={t('detail.title')} wide>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-display text-lg font-semibold text-ink">
          {destinationLabel(current, locale, t)}
        </span>
        <span className="flex items-center gap-2">
          <PaymentChip order={current} />
          <Badge
            tone={
              current.status === 'delivered'
                ? 'success'
                : current.status === 'cancelled'
                  ? 'neutral'
                  : 'gold'
            }
          >
            {t(`board.status.${current.status}`)}
          </Badge>
        </span>
      </div>
      <p className="mt-1 text-sm text-ink-soft">
        {current.guestName} · {t('card.roomWord')}{' '}
        <Bdi>{current.roomNumber}</Bdi>
      </p>

      {/* Lines */}
      <div className="mt-4 overflow-hidden rounded-lg border border-line">
        <table className="w-full text-sm">
          <tbody>
            {current.lines.map((line) => (
              <tr key={line.id} className="border-b border-line/60 last:border-0">
                <td className="px-3 py-2 font-medium tabular-nums text-ink">
                  {line.quantity}×
                </td>
                <td className="w-full px-3 py-2">
                  <span className="text-ink">{lineName(line)}</span>
                  {line.variantOptionNameEn ? (
                    <span className="text-ink-soft"> · {optionName(line)}</span>
                  ) : null}
                  {line.note ? (
                    <p className="mt-0.5 text-xs italic text-ink-soft">
                      “{line.note}”{' '}
                      <span className="not-italic rounded bg-line/60 px-1 text-[10px] font-bold uppercase tracking-wider">
                        {current.guestLanguage}
                      </span>
                    </p>
                  ) : null}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-end tabular-nums text-ink">
                  {line.included
                    ? t('payment.included')
                    : formatCurrency(line.lineTotal, current.currency)}
                </td>
              </tr>
            ))}
            <tr className="bg-paper">
              <td />
              <td className="px-3 py-2 text-sm font-medium text-ink">
                {t('detail.total')}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-end font-display font-semibold tabular-nums text-ink">
                {formatCurrency(current.totalAmount, current.currency)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Timeline */}
      <ol className="mt-4 space-y-1 text-sm">
        {timeline.map(([key, at]) => (
          <li key={key} className="flex items-center justify-between gap-3">
            <span className={at ? 'text-ink' : 'text-ink-soft/60'}>
              {t(`detail.timeline.${key}`)}
            </span>
            <span className="tabular-nums text-ink-soft">
              {at ? formatDateTime(at) : '—'}
            </span>
          </li>
        ))}
      </ol>
      {current.cancelledReason && current.cancelledReason !== 'guest' ? (
        <p className="mt-2 text-sm text-ink-soft">
          {t(`detail.cancel.reasons.${current.cancelledReason}`)}
          {current.cancelNote ? ` — ${current.cancelNote}` : ''}
        </p>
      ) : null}

      {/* Assignment */}
      {canUpdate &&
      ['new', 'preparing', 'on_the_way'].includes(current.status) ? (
        <label className="mt-4 block">
          <span className="mb-1 block text-sm font-medium text-ink">
            {t('detail.assign.label')}
          </span>
          <select
            className={`${selectClass} w-full`}
            value={current.assignedTo?.id ?? ''}
            disabled={mutationsDisabled}
            onChange={(e) =>
              void act('assign', { assigneeId: e.target.value || null })
            }
          >
            <option value="">{t('detail.assign.unassigned')}</option>
            {assignees.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} — {locale === 'ar' ? a.roleNameAr : a.roleNameEn}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}

      {/* Transitions (16.7 AC2) */}
      {canUpdate ? (
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          {['new', 'preparing'].includes(current.status) ? (
            <Button
              variant="danger"
              onClick={() => setCancelling(true)}
              disabled={mutationsDisabled}
            >
              {t('detail.actions.cancel')}
            </Button>
          ) : null}
          {current.status === 'new' ? (
            <Button onClick={() => void act('start')} disabled={mutationsDisabled}>
              {t('detail.actions.start')}
            </Button>
          ) : null}
          {current.status === 'preparing' ? (
            <Button
              onClick={() => void act('out-for-delivery')}
              disabled={mutationsDisabled}
            >
              {t('detail.actions.outForDelivery')}
            </Button>
          ) : null}
          {current.status === 'on_the_way' ? (
            <Button
              onClick={() => void act('deliver')}
              disabled={mutationsDisabled}
            >
              {t('detail.actions.deliver')}
            </Button>
          ) : null}
        </div>
      ) : null}

      {/* Staff cancel with reason (note required for "other") */}
      <ConfirmModal
        open={cancelling}
        onClose={() => setCancelling(false)}
        title={t('detail.cancel.title')}
        confirmLabel={t('detail.cancel.confirm')}
        onConfirm={() => {
          if (cancelReason === 'other' && !cancelNote.trim()) {
            setCancelError(t('detail.cancel.noteHint'));
            return;
          }
          setCancelError(null);
          void act('cancel', {
            reason: cancelReason,
            ...(cancelNote.trim() ? { note: cancelNote.trim() } : {}),
          });
        }}
        destructive
        loading={busy}
        error={cancelError ?? undefined}
      >
        <p className="text-sm text-ink-soft">{t('detail.cancel.note')}</p>
        <label className="mt-3 block">
          <span className="mb-1 block text-sm font-medium text-ink">
            {t('detail.cancel.reasonLabel')}
          </span>
          <select
            className={`${selectClass} w-full`}
            value={cancelReason}
            onChange={(e) =>
              setCancelReason(e.target.value as FnbCancelReason)
            }
          >
            {STAFF_FNB_CANCEL_REASONS.map((reason) => (
              <option key={reason} value={reason}>
                {t(`detail.cancel.reasons.${reason}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="mt-3 block">
          <span className="mb-1 block text-sm font-medium text-ink">
            {t('detail.cancel.noteLabel')}
            {cancelReason === 'other' ? (
              <span className="text-danger"> *</span>
            ) : null}
          </span>
          <textarea
            className="w-full rounded-lg border border-line p-2 text-sm"
            rows={2}
            value={cancelNote}
            onChange={(e) => setCancelNote(e.target.value)}
          />
          <span className="mt-1 block text-xs text-ink-soft">
            {t('detail.cancel.noteHint')}
          </span>
        </label>
      </ConfirmModal>

      <div className="mt-4 flex justify-end">
        <Button variant="ghost" onClick={onClose}>
          {tCommon('actions.close')}
        </Button>
      </div>
    </Modal>
  );
}
