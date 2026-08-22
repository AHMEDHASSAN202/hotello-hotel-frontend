'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { CopyButton } from '@/components/copy-button';
import { ConfirmModal, ConsequenceNote, RequiredNote } from '@/components/guidance';
import { RoomPicker } from '@/components/stays/room-picker';
import { useTenant } from '@/components/tenant-provider';
import {
  Badge,
  Button,
  Code,
  ErrorState,
  Field,
  Modal,
  selectClass,
} from '@/components/ui';
import { useFormatters } from '@/i18n/use-format';
import { api, ApiError } from '@/lib/api';
import { useApiError } from '@/lib/errors';
import type {
  AvailableRoom,
  GuestLanguage,
  StayFnbOrdersResponse,
  StayType,
  Stay,
  StayWithCode,
} from '@/lib/types';
import { GUEST_LANGUAGES, STAY_TYPES } from '@/lib/types';

type Mode = 'view' | 'edit' | 'extend' | 'move';

/**
 * 13.3 — the stay drawer: guest info, masked code (hash-only storage — no
 * reveal, only Regenerate), extend/shorten, change room, checkout. Actions
 * are permission-gated and disabled under readOnly; a checked-out stay is a
 * read-only record (13.4 AC4).
 */
export function StayDetailModal({
  stay,
  onClose,
  onChanged,
}: {
  stay: Stay | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const t = useTranslations('stays.detail');
  const tStays = useTranslations('stays');
  const tLangs = useTranslations('stays.languages');
  const tStayTypes = useTranslations('stays.stayTypes');
  const tList = useTranslations('stays.list');
  const tG = useTranslations('guidance.stays');
  const tCommon = useTranslations('common');
  const tFnbStay = useTranslations('fnb.stayOrders');
  const tFnbPay = useTranslations('fnb.payment');
  const tFnbBoard = useTranslations('fnb.board');
  const resolveError = useApiError();
  const { locale, formatDate, formatDateTime, formatCurrency } = useFormatters();
  const { hasPermission, isModuleEnabled, readOnly } = useTenant();

  const canUpdate = hasPermission('stays.update');
  const canCheckout = hasPermission('stays.checkout');
  // Epic 16 (16.8) — room-charge visibility; hidden entirely without the module.
  const showFnbOrders =
    isModuleEnabled('fnb') && hasPermission('fnb_orders.read');

  const [current, setCurrent] = useState<Stay | null>(stay);
  const [mode, setMode] = useState<Mode>('view');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit form
  const [editForm, setEditForm] = useState({
    guestName: '',
    language: 'en' as GuestLanguage,
    stayType: 'room_only' as StayType,
    email: '',
    phone: '',
    guestsCount: '',
    note: '',
  });
  // Extend form
  const [newCheckOut, setNewCheckOut] = useState('');
  // Move form
  const [rooms, setRooms] = useState<AvailableRoom[] | null>(null);
  const [targetRoom, setTargetRoom] = useState<string | null>(null);
  // Confirms + one-time code display
  const [confirming, setConfirming] = useState<'regenerate' | 'checkout' | 'settle' | null>(null);
  const [newCode, setNewCode] = useState<string | null>(null);
  // Epic 16 (16.8) — the stay's F&B orders + unsettled room charges.
  const [fnbOrders, setFnbOrders] = useState<StayFnbOrdersResponse | null>(null);

  useEffect(() => {
    setCurrent(stay);
    setMode('view');
    setError(null);
    setNewCode(null);
    setConfirming(null);
    setFnbOrders(null);
    if (stay && isModuleEnabled('fnb') && hasPermission('fnb_orders.read')) {
      api<StayFnbOrdersResponse>(`/tenant/fnb-orders/stay/${stay.id}`)
        .then(setFnbOrders)
        .catch(() => setFnbOrders(null));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stay]);

  const active = current?.status === 'active';
  const disabledHint = readOnly ? tList('readOnlyHint') : undefined;

  const applyResult = useCallback(
    (updated: Stay) => {
      setCurrent(updated);
      setMode('view');
      onChanged();
    },
    [onChanged],
  );

  async function run<T>(
    request: () => Promise<T>,
    onSuccess: (result: T) => void,
  ) {
    setBusy(true);
    setError(null);
    try {
      const result = await request();
      onSuccess(result);
    } catch (err) {
      setError(
        err instanceof ApiError ? resolveError(err) : t('loadError'),
      );
    } finally {
      setBusy(false);
    }
  }

  function startEdit() {
    if (!current) return;
    setEditForm({
      guestName: current.guestName,
      language: current.language,
      stayType: current.stayType,
      email: current.email ?? '',
      phone: current.phone ?? '',
      guestsCount: current.guestsCount ? String(current.guestsCount) : '',
      note: current.note ?? '',
    });
    setError(null);
    setMode('edit');
  }

  function startExtend() {
    if (!current) return;
    setNewCheckOut(current.checkOutDate);
    setError(null);
    setMode('extend');
  }

  function startMove() {
    setTargetRoom(null);
    setRooms(null);
    setError(null);
    setMode('move');
    api<AvailableRoom[]>('/tenant/stays/available-rooms')
      .then(setRooms)
      .catch(() => setRooms([]));
  }

  function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!current) return;
    run(
      () =>
        api<Stay>(`/tenant/stays/${current.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            guestName: editForm.guestName.trim(),
            language: editForm.language,
            stayType: editForm.stayType,
            email: editForm.email.trim() || null,
            phone: editForm.phone.trim() || null,
            guestsCount: editForm.guestsCount
              ? Number(editForm.guestsCount)
              : null,
            note: editForm.note.trim() || null,
          }),
        }),
      applyResult,
    );
  }

  function saveExtend(e: React.FormEvent) {
    e.preventDefault();
    if (!current) return;
    run(
      () =>
        api<Stay>(`/tenant/stays/${current.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ checkOutDate: newCheckOut }),
        }),
      applyResult,
    );
  }

  function saveMove() {
    if (!current || !targetRoom) return;
    run(
      () =>
        api<Stay>(`/tenant/stays/${current.id}/change-room`, {
          method: 'POST',
          body: JSON.stringify({ roomId: targetRoom }),
        }),
      applyResult,
    );
  }

  function regenerate() {
    if (!current) return;
    run(
      () =>
        api<StayWithCode>(`/tenant/stays/${current.id}/regenerate-code`, {
          method: 'POST',
        }),
      (result) => {
        setConfirming(null);
        setNewCode(result.code);
        setCurrent(result.stay);
      },
    );
  }

  function settle() {
    if (!current) return;
    run(
      () =>
        api<{ settled: number; unsettledTotal: number }>(
          `/tenant/fnb-orders/stay/${current.id}/settle`,
          { method: 'POST', body: JSON.stringify({}) },
        ),
      () => {
        setConfirming(null);
        api<StayFnbOrdersResponse>(`/tenant/fnb-orders/stay/${current.id}`)
          .then(setFnbOrders)
          .catch(() => {});
      },
    );
  }

  function checkout() {
    if (!current) return;
    run(
      async () => {
        // 16.8 AC2 — the interlock: settling rides the checkout confirm, so
        // no order leaves unpaid without the desk seeing the amount.
        if ((fnbOrders?.unsettledTotal ?? 0) > 0) {
          await api(`/tenant/fnb-orders/stay/${current.id}/settle`, {
            method: 'POST',
            body: JSON.stringify({}),
          });
        }
        return api<Stay>(`/tenant/stays/${current.id}/checkout`, {
          method: 'POST',
        });
      },
      (result) => {
        setConfirming(null);
        applyResult(result);
      },
    );
  }

  if (!current) return null;

  const row = (label: string, value: React.ReactNode) => (
    <div className="flex items-baseline justify-between gap-4 border-b border-line/60 py-2 text-sm last:border-b-0">
      <span className="shrink-0 text-ink-soft">{label}</span>
      <span className="text-end text-ink">{value ?? t('notSet')}</span>
    </div>
  );

  return (
    <Modal open={current !== null} onClose={onClose} title={t('title')} wide>
      {mode === 'view' && (
        <div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Code>{current.roomNumber}</Code>
              <span className="font-display text-lg font-semibold text-ink">
                {current.guestName}
              </span>
            </div>
            <span className="flex items-center gap-2">
              <Badge tone={active ? 'success' : 'neutral'}>
                {tList(`status.${current.status}`)}
              </Badge>
            </span>
          </div>

          <div className="mt-4">
            {row(
              t('dates'),
              `${formatDate(current.checkInDate)} → ${formatDate(current.checkOutDate)}`,
            )}
            {active &&
              row(
                tList('columns.nights'),
                tList('nights', { count: current.nightsRemaining ?? 0 }),
              )}
            {row(t('language'), tLangs(current.language))}
            {row(t('stayType'), tStayTypes(current.stayType))}
            {row(t('email'), current.email)}
            {row(t('phone'), current.phone)}
            {row(t('guestsCount'), current.guestsCount)}
            {row(t('note'), current.note)}
            {!active &&
              row(
                t('checkedOutAt'),
                current.checkedOutAt
                  ? `${formatDateTime(current.checkedOutAt)} · ${tList(
                      `checkoutType.${current.checkoutType ?? 'manual'}`,
                    )}`
                  : t('notSet'),
              )}
          </div>

          {/* The code: hash-only storage — masked forever, regenerate to replace. */}
          {active && (
            <div className="mt-4 rounded-lg border border-line bg-paper p-4">
              <p className="text-xs font-medium uppercase tracking-widest text-ink-soft">
                {t('codeLabel')}
              </p>
              {newCode ? (
                <div className="mt-2">
                  <div className="flex items-center gap-3">
                    <span
                      dir="ltr"
                      className="rounded-lg border border-gold bg-white px-4 py-2 font-mono text-2xl tracking-[0.35em] text-ink"
                    >
                      {newCode}
                    </span>
                    <CopyButton value={newCode} />
                  </div>
                  <p className="mt-2 text-sm font-medium text-danger">
                    {tStays('checkin.success.notShownAgain')}
                  </p>
                </div>
              ) : (
                <div className="mt-2 flex items-center justify-between gap-3">
                  <span
                    dir="ltr"
                    className="font-mono text-2xl tracking-[0.35em] text-ink-soft"
                    aria-hidden
                  >
                    ••••••
                  </span>
                  <p className="text-xs text-ink-soft">{tG('codeNote')}</p>
                </div>
              )}
            </div>
          )}

          {/* Epic 16 (16.8 AC1) — the stay's F&B orders + unsettled charges. */}
          {showFnbOrders && fnbOrders && fnbOrders.data.length > 0 && (
            <div className="mt-4 rounded-lg border border-line bg-paper p-4">
              <p className="text-xs font-medium uppercase tracking-widest text-ink-soft">
                {tFnbStay('title')}
              </p>
              <ul className="mt-2 space-y-1.5">
                {fnbOrders.data.map((order) => (
                  <li
                    key={order.id}
                    className="flex flex-wrap items-center justify-between gap-2 text-sm"
                  >
                    <span className="tabular-nums text-ink-soft">
                      {formatDateTime(order.createdAt)}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="tabular-nums text-ink">
                        {order.totalAmount === 0
                          ? tFnbPay('included')
                          : formatCurrency(order.totalAmount, order.currency)}
                      </span>
                      {order.paymentMethod === 'room_charge' ? (
                        <Badge tone={order.settledAt ? 'neutral' : 'warning'}>
                          {order.settledAt
                            ? tFnbPay('settled')
                            : tFnbPay('roomCharge')}
                        </Badge>
                      ) : null}
                      <Badge
                        tone={
                          order.status === 'delivered'
                            ? 'success'
                            : order.status === 'cancelled'
                              ? 'neutral'
                              : 'gold'
                        }
                      >
                        {tFnbBoard(`status.${order.status}`)}
                      </Badge>
                    </span>
                  </li>
                ))}
              </ul>
              {fnbOrders.unsettledTotal > 0 && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line/60 pt-3">
                  <p className="text-sm font-medium text-danger">
                    {tFnbStay('unsettled', {
                      amount: formatCurrency(
                        fnbOrders.unsettledTotal,
                        fnbOrders.data[0]?.currency ?? 'EGP',
                      ),
                    })}
                  </p>
                  {canCheckout && (
                    <Button
                      variant="ghost"
                      onClick={() => setConfirming('settle')}
                      disabled={readOnly}
                      title={disabledHint}
                    >
                      {tFnbStay('settle')}
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}

          {error && (
            <p role="alert" className="mt-3 text-sm text-danger">
              {error}
            </p>
          )}

          {active && (
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              {canUpdate && (
                <>
                  <Button
                    variant="ghost"
                    onClick={startEdit}
                    disabled={readOnly}
                    title={disabledHint}
                  >
                    {t('actions.edit')}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={startExtend}
                    disabled={readOnly}
                    title={disabledHint}
                  >
                    {t('actions.extend')}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={startMove}
                    disabled={readOnly}
                    title={disabledHint}
                  >
                    {t('actions.changeRoom')}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setConfirming('regenerate')}
                    disabled={readOnly}
                    title={disabledHint}
                  >
                    {t('actions.regenerate')}
                  </Button>
                </>
              )}
              {canCheckout && (
                <Button
                  variant="danger"
                  onClick={() => setConfirming('checkout')}
                  disabled={readOnly}
                  title={disabledHint}
                >
                  {t('actions.checkout')}
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {mode === 'edit' && (
        <form onSubmit={saveEdit} className="space-y-4">
          <h3 className="font-display text-lg font-semibold text-ink">
            {tStays('edit.title')}
          </h3>
          <Field
            label={tStays('checkin.guestName.label')}
            hint={tStays('checkin.guestName.hint')}
            required
            value={editForm.guestName}
            onChange={(e) =>
              setEditForm((f) => ({ ...f, guestName: e.target.value }))
            }
          />
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-ink">
              {tStays('checkin.language.label')}{' '}
              <span className="text-danger">*</span>
            </span>
            <select
              className={`${selectClass} w-full`}
              value={editForm.language}
              onChange={(e) =>
                setEditForm((f) => ({
                  ...f,
                  language: e.target.value as GuestLanguage,
                }))
              }
            >
              {GUEST_LANGUAGES.map((lang) => (
                <option key={lang} value={lang}>
                  {tLangs(lang)}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-ink-soft">
              {tStays('checkin.language.hint')}
            </span>
          </label>
          {/* 16.1 AC1 — editable later; the change lands in the audit diff. */}
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-ink">
              {tStays('edit.stayType')} <span className="text-danger">*</span>
            </span>
            <select
              className={`${selectClass} w-full`}
              value={editForm.stayType}
              onChange={(e) =>
                setEditForm((f) => ({
                  ...f,
                  stayType: e.target.value as StayType,
                }))
              }
            >
              {STAY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {tStayTypes(type)}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label={tStays('checkin.email.label')}
              type="email"
              value={editForm.email}
              onChange={(e) =>
                setEditForm((f) => ({ ...f, email: e.target.value }))
              }
            />
            <Field
              label={tStays('checkin.phone.label')}
              value={editForm.phone}
              onChange={(e) =>
                setEditForm((f) => ({ ...f, phone: e.target.value }))
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label={tStays('checkin.guestsCount.label')}
              type="number"
              min={1}
              max={50}
              value={editForm.guestsCount}
              onChange={(e) =>
                setEditForm((f) => ({ ...f, guestsCount: e.target.value }))
              }
            />
            <Field
              label={tStays('checkin.note.label')}
              hint={tStays('checkin.note.hint')}
              value={editForm.note}
              onChange={(e) =>
                setEditForm((f) => ({ ...f, note: e.target.value }))
              }
            />
          </div>
          <RequiredNote />
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setMode('view')}>
              {tCommon('actions.cancel')}
            </Button>
            <Button type="submit" loading={busy}>
              {busy ? tStays('edit.saving') : tStays('edit.save')}
            </Button>
          </div>
        </form>
      )}

      {mode === 'extend' && (
        <form onSubmit={saveExtend} className="space-y-4">
          <h3 className="font-display text-lg font-semibold text-ink">
            {tStays('extend.title')}
          </h3>
          <Field
            label={tStays('extend.label')}
            hint={tStays('extend.hint')}
            type="date"
            required
            min={current.checkInDate}
            value={newCheckOut}
            onChange={(e) => setNewCheckOut(e.target.value)}
          />
          <ConsequenceNote>{tStays('extend.note')}</ConsequenceNote>
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setMode('view')}>
              {tCommon('actions.cancel')}
            </Button>
            <Button type="submit" loading={busy}>
              {tStays('extend.save')}
            </Button>
          </div>
        </form>
      )}

      {mode === 'move' && (
        <div className="space-y-4">
          <h3 className="font-display text-lg font-semibold text-ink">
            {tStays('changeRoom.title')}
          </h3>
          <p className="text-sm text-ink-soft">
            {tStays('changeRoom.current', { room: current.roomNumber })}
          </p>
          {rooms === null ? (
            <p className="text-sm text-ink-soft">…</p>
          ) : (
            <RoomPicker
              rooms={rooms}
              value={targetRoom}
              onChange={setTargetRoom}
            />
          )}
          <ConsequenceNote>{tStays('changeRoom.note')}</ConsequenceNote>
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setMode('view')}>
              {tCommon('actions.cancel')}
            </Button>
            <Button onClick={saveMove} loading={busy} disabled={!targetRoom}>
              {tStays('changeRoom.save')}
            </Button>
          </div>
        </div>
      )}

      {/* 13.3 AC4 — regenerate: reversible-ish (a new code exists), not red. */}
      <ConfirmModal
        open={confirming === 'regenerate'}
        onClose={() => setConfirming(null)}
        title={tStays('regenerate.title')}
        confirmLabel={tStays('regenerate.confirm')}
        onConfirm={regenerate}
        loading={busy}
        error={error}
      >
        <ConsequenceNote>{tStays('regenerate.note')}</ConsequenceNote>
      </ConfirmModal>

      {/* 13.4 AC1 — checkout is irreversible: destructive styling earned. */}
      <ConfirmModal
        open={confirming === 'checkout'}
        onClose={() => setConfirming(null)}
        title={tStays('checkout.title', { name: current.guestName })}
        confirmLabel={tStays('checkout.confirm')}
        onConfirm={checkout}
        destructive
        loading={busy}
        error={error}
      >
        <ConsequenceNote tone="danger">{tStays('checkout.note')}</ConsequenceNote>
        {/* 16.8 AC2 — surface uncollected room charges inside the confirm. */}
        {(fnbOrders?.unsettledTotal ?? 0) > 0 && (
          <div className="mt-2">
            <ConsequenceNote tone="danger">
              {tFnbStay('checkoutNote', {
                amount: formatCurrency(
                  fnbOrders!.unsettledTotal,
                  fnbOrders!.data[0]?.currency ?? 'EGP',
                ),
              })}
            </ConsequenceNote>
          </div>
        )}
      </ConfirmModal>

      <ConfirmModal
        open={confirming === 'settle'}
        onClose={() => setConfirming(null)}
        title={tFnbStay('settleTitle')}
        confirmLabel={tFnbStay('settleConfirm')}
        onConfirm={settle}
        loading={busy}
        error={error}
      >
        <ConsequenceNote tone="danger">
          {tFnbStay('settleNote', {
            amount: formatCurrency(
              fnbOrders?.unsettledTotal ?? 0,
              fnbOrders?.data[0]?.currency ?? 'EGP',
            ),
          })}
        </ConsequenceNote>
      </ConfirmModal>
    </Modal>
  );
}
