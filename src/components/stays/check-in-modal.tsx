'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CopyButton } from '@/components/copy-button';
import { RequiredNote } from '@/components/guidance';
import { RoomPicker } from '@/components/stays/room-picker';
import { useTenant } from '@/components/tenant-provider';
import { Button, ErrorState, Field, Modal, selectClass } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useApiError } from '@/lib/errors';
import type {
  AvailableRoom,
  GuestLanguage,
  StaySettings,
  StayType,
  StayWithCode,
} from '@/lib/types';
import { GUEST_LANGUAGES, STAY_TYPES } from '@/lib/types';

/** Local calendar date as YYYY-MM-DD (the desk's clock ≈ hotel time). */
const localDate = (offsetDays = 0): string => {
  const d = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
  return d.toLocaleDateString('en-CA');
};

interface FormState {
  guestName: string;
  roomId: string | null;
  checkInDate: string;
  checkOutDate: string;
  language: GuestLanguage;
  /** 16.1 AC2 — pre-selected from the hotel's default stay type. */
  stayType: StayType;
  email: string;
  phone: string;
  guestsCount: string;
  note: string;
}

/**
 * 13.1 — the most-used screen in the product. One modal, two steps: the
 * form, then the one-time code screen (the code is hash-only server-side —
 * it will never be shown again, 12.2 AC4 wording included).
 */
export function CheckInModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const t = useTranslations('stays.checkin');
  const tLangs = useTranslations('stays.languages');
  const tStayTypes = useTranslations('stays.stayTypes');
  const tCommon = useTranslations('common');
  const resolveError = useApiError();
  const { me } = useTenant();

  // 13.1 AC1 — default = hotel default language when it's a guest language.
  const defaultLanguage: GuestLanguage = useMemo(() => {
    const hotelDefault = me?.hotel.defaultLanguage;
    return hotelDefault &&
      (GUEST_LANGUAGES as readonly string[]).includes(hotelDefault)
      ? (hotelDefault as GuestLanguage)
      : 'en';
  }, [me]);

  const emptyForm = useCallback(
    (): FormState => ({
      guestName: '',
      roomId: null,
      checkInDate: localDate(),
      checkOutDate: localDate(1),
      language: defaultLanguage,
      stayType: 'room_only',
      email: '',
      phone: '',
      guestsCount: '',
      note: '',
    }),
    [defaultLanguage],
  );

  const [form, setForm] = useState<FormState>(emptyForm);
  const [rooms, setRooms] = useState<AvailableRoom[] | null>(null);
  const [roomsError, setRoomsError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});
  const [success, setSuccess] = useState<StayWithCode | null>(null);

  const loadRooms = useCallback(async () => {
    setRoomsError(null);
    try {
      const res = await api<AvailableRoom[]>('/tenant/stays/available-rooms');
      setRooms(res);
    } catch (err) {
      setRooms([]);
      setRoomsError(
        err instanceof ApiError ? resolveError(err) : t('room.loadError'),
      );
    }
  }, [resolveError, t]);

  useEffect(() => {
    if (!open) return;
    setForm(emptyForm());
    setSuccess(null);
    setFormError(null);
    setFieldErrors({});
    setRooms(null);
    loadRooms();
    // 16.1 AC2 — the hotel default pre-selects the stay type; a fetch
    // failure just leaves the safe room_only default.
    api<StaySettings>('/tenant/stays/settings')
      .then((s) => {
        if (s?.defaultStayType) {
          setForm((f) => ({ ...f, stayType: s.defaultStayType }));
        }
      })
      .catch(() => undefined);
  }, [open, emptyForm, loadRooms]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.roomId) return;
    setSubmitting(true);
    setFormError(null);
    setFieldErrors({});
    try {
      const created = await api<StayWithCode>('/tenant/stays', {
        method: 'POST',
        body: JSON.stringify({
          guestName: form.guestName.trim(),
          roomId: form.roomId,
          checkInDate: form.checkInDate,
          checkOutDate: form.checkOutDate,
          language: form.language,
          stayType: form.stayType,
          ...(form.email.trim() ? { email: form.email.trim() } : {}),
          ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
          ...(form.guestsCount
            ? { guestsCount: Number(form.guestsCount) }
            : {}),
          ...(form.note.trim() ? { note: form.note.trim() } : {}),
        }),
      });
      setSuccess(created);
      onCreated();
    } catch (err) {
      if (err instanceof ApiError) {
        const message = resolveError(err);
        if (err.code === 'ROOM_OCCUPIED' || err.code === 'ROOM_NOT_AVAILABLE') {
          setFieldErrors({ room: message });
          loadRooms(); // the board changed under us — refresh availability
        } else if (err.code === 'INVALID_STAY_DATES') {
          setFieldErrors({ checkOutDate: message });
        } else {
          setFormError(message);
        }
      } else {
        setFormError(resolveError(err));
      }
    } finally {
      setSubmitting(false);
    }
  }

  function finish() {
    setSuccess(null);
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={success ? finish : onClose}
      title={
        success
          ? t('success.title', { name: success.stay.guestName })
          : t('title')
      }
      wide
    >
      {success ? (
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-ink-soft">
            {t('success.codeLabel')}
          </p>
          <div className="mt-2 flex items-center gap-3">
            <span
              dir="ltr"
              className="rounded-lg border border-gold bg-paper px-6 py-3 font-mono text-3xl tracking-[0.4em] text-ink"
            >
              {success.code}
            </span>
            <CopyButton value={success.code} label={t('success.copy')} />
          </div>
          <p className="mt-4 text-sm text-ink">{t('success.instruction')}</p>
          {/* 12.2 AC4 — one-time secrets carry the highest-stakes copy. */}
          <p className="mt-2 text-sm font-medium text-danger">
            {t('success.notShownAgain')}
          </p>
          {success.stay.email && (
            <p className="mt-2 text-sm text-ink-soft">
              {t('success.emailSent', { email: success.stay.email })}
            </p>
          )}
          <div className="mt-6 flex justify-end">
            <Button onClick={finish}>{t('success.done')}</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field
            label={t('guestName.label')}
            placeholder={t('guestName.placeholder')}
            hint={t('guestName.hint')}
            required
            value={form.guestName}
            onChange={(e) => set('guestName', e.target.value)}
          />

          <div>
            <span className="mb-1 block text-sm font-medium text-ink">
              {t('room.label')} <span className="text-danger">*</span>
            </span>
            {rooms === null ? (
              <p className="text-sm text-ink-soft">…</p>
            ) : roomsError ? (
              <ErrorState message={roomsError} onRetry={loadRooms} />
            ) : (
              <RoomPicker
                rooms={rooms}
                value={form.roomId}
                onChange={(roomId) => {
                  setFieldErrors((f) => ({ ...f, room: undefined }));
                  set('roomId', roomId);
                }}
                error={fieldErrors.room}
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field
              label={t('checkInDate.label')}
              type="date"
              required
              value={form.checkInDate}
              onChange={(e) => set('checkInDate', e.target.value)}
            />
            <Field
              label={t('checkOutDate.label')}
              hint={t('checkOutDate.hint')}
              error={fieldErrors.checkOutDate}
              type="date"
              required
              min={form.checkInDate}
              value={form.checkOutDate}
              onChange={(e) => set('checkOutDate', e.target.value)}
            />
          </div>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-ink">
              {t('language.label')} <span className="text-danger">*</span>
            </span>
            <select
              className={`${selectClass} w-full`}
              value={form.language}
              onChange={(e) => set('language', e.target.value as GuestLanguage)}
            >
              {GUEST_LANGUAGES.map((lang) => (
                <option key={lang} value={lang}>
                  {tLangs(lang)}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-ink-soft">
              {t('language.hint')}
            </span>
          </label>

          {/* 16.1 AC1/AC2 — board basis; pre-selected from the hotel default. */}
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-ink">
              {t('stayType.label')} <span className="text-danger">*</span>
            </span>
            <select
              className={`${selectClass} w-full`}
              value={form.stayType}
              onChange={(e) => set('stayType', e.target.value as StayType)}
            >
              {STAY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {tStayTypes(type)}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-ink-soft">
              {t('stayType.hint')}
            </span>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <Field
              label={t('email.label')}
              placeholder={t('email.placeholder')}
              hint={t('email.hint')}
              type="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
            />
            <Field
              label={t('phone.label')}
              placeholder={t('phone.placeholder')}
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field
              label={t('guestsCount.label')}
              placeholder={t('guestsCount.placeholder')}
              type="number"
              min={1}
              max={50}
              value={form.guestsCount}
              onChange={(e) => set('guestsCount', e.target.value)}
            />
            <Field
              label={t('note.label')}
              placeholder={t('note.placeholder')}
              hint={t('note.hint')}
              value={form.note}
              onChange={(e) => set('note', e.target.value)}
            />
          </div>

          <RequiredNote />

          {formError && (
            <p role="alert" className="text-sm text-danger">
              {formError}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              {tCommon('actions.cancel')}
            </Button>
            <Button
              type="submit"
              loading={submitting}
              disabled={!form.roomId || !form.guestName.trim()}
            >
              {submitting ? t('submitting') : t('submit')}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
