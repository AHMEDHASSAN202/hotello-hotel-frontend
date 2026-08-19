'use client';

import { useLocale, useTranslations } from 'next-intl';
import { FormEvent, useEffect, useState } from 'react';
import { ConsequenceNote, InfoTip, RequiredNote } from '@/components/guidance';
import { Button, Field, Modal, selectClass } from '@/components/ui';
import type { Locale } from '@/i18n/config';
import { api, ApiError } from '@/lib/api';
import { useApiError } from '@/lib/errors';
import type { Room, RoomStatus, RoomType } from '@/lib/types';

interface FormState {
  roomNumber: string;
  floor: string;
  roomTypeId: string;
  status: RoomStatus;
}

const STATUSES: RoomStatus[] = ['active', 'out_of_service', 'inactive'];

/** Active + out_of_service count toward the plan's room limit; inactive
 * doesn't (global constraint). Used to decide when a status edit is worth a
 * ConsequenceNote — a change that doesn't affect countability isn't. */
const isCountable = (status: RoomStatus) => status !== 'inactive';

const statusToggleClass = (active: boolean) =>
  `rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
    active
      ? 'border-ink bg-ink text-white'
      : 'border-line bg-white text-ink-soft hover:text-ink'
  }`;

/**
 * Story 11.4 — edit a room. Two edits carry consequences worth calling out
 * before saving: changing the room number invalidates any card already
 * printed with the old one (AC1), and flipping a room's countability
 * (active/out_of_service ⇄ inactive) changes what counts toward the plan's
 * room limit.
 */
export function EditRoomModal({
  room,
  types,
  onClose,
  onSaved,
}: {
  room: Room | null;
  types: RoomType[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations('rooms');
  const tCommon = useTranslations('common');
  const tG = useTranslations('guidance.rooms');
  const resolveError = useApiError();
  const locale = useLocale() as Locale;

  const activeTypes = types.filter(
    (rt) => rt.isActive || rt.id === room?.roomType.id,
  );
  const typeName = (rt: RoomType) => (locale === 'ar' ? rt.nameAr : rt.nameEn);

  const [form, setForm] = useState<FormState>({
    roomNumber: '',
    floor: '',
    roomTypeId: '',
    status: 'active',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [formErrorRemaining, setFormErrorRemaining] = useState<number | null>(
    null,
  );
  const [fieldErrors, setFieldErrors] = useState<{ roomNumber?: string }>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (room) {
      setForm({
        roomNumber: room.roomNumber,
        floor: room.floor === null ? '' : String(room.floor),
        roomTypeId: room.roomType.id,
        status: room.status,
      });
      setFormError(null);
      setFormErrorRemaining(null);
      setFieldErrors({});
    }
  }, [room]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!room) return;
    setSaving(true);
    setFormError(null);
    setFormErrorRemaining(null);
    setFieldErrors({});
    try {
      await api(`/tenant/rooms/${room.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          roomNumber: form.roomNumber,
          floor: form.floor ? Number(form.floor) : null,
          roomTypeId: form.roomTypeId,
          status: form.status,
        }),
      });
      onSaved();
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'ROOM_NUMBER_TAKEN') {
        setFieldErrors({ roomNumber: resolveError(err) });
      } else if (err instanceof ApiError && err.code === 'ROOM_LIMIT_REACHED') {
        setFormError(resolveError(err));
        const remaining = (err.details as { remaining?: number } | undefined)
          ?.remaining;
        setFormErrorRemaining(typeof remaining === 'number' ? remaining : null);
      } else {
        setFormError(resolveError(err));
      }
    } finally {
      setSaving(false);
    }
  }

  const roomNumberChanged =
    room !== null &&
    form.roomNumber.trim().toUpperCase() !==
      room.roomNumber.trim().toUpperCase();
  const countabilityChanged =
    room !== null &&
    form.status !== room.status &&
    isCountable(form.status) !== isCountable(room.status);

  return (
    <Modal
      open={room !== null}
      onClose={onClose}
      title={t('form.editTitle')}
      wide
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {formError && (
          <div
            role="alert"
            className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger"
          >
            <p>{formError}</p>
            {formErrorRemaining !== null && (
              <p className="mt-1">
                {t('form.preview.remaining', { count: formErrorRemaining })}
              </p>
            )}
          </div>
        )}

        <Field
          label={t('form.roomNumber')}
          required
          dir="ltr"
          hint={t('form.roomNumberHint')}
          error={fieldErrors.roomNumber}
          value={form.roomNumber}
          onChange={(e) => set('roomNumber', e.target.value)}
        />
        {roomNumberChanged && (
          <ConsequenceNote tone="danger">{tG('renumber')}</ConsequenceNote>
        )}

        <Field
          label={t('form.floorOptional')}
          type="number"
          placeholder={t('form.floorPlaceholder')}
          hint={t('form.floorHint')}
          value={form.floor}
          onChange={(e) => set('floor', e.target.value)}
        />

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink">
            {t('form.roomType')}
            <span aria-hidden className="text-danger">
              {' '}
              *
            </span>
          </span>
          <select
            required
            className={`${selectClass} w-full`}
            value={form.roomTypeId}
            onChange={(e) => set('roomTypeId', e.target.value)}
          >
            {activeTypes.map((rt) => (
              <option key={rt.id} value={rt.id}>
                {typeName(rt)}
              </option>
            ))}
          </select>
        </label>

        <div>
          <span className="mb-1 block text-sm font-medium text-ink">
            {t('form.status')}
          </span>
          <div className="flex flex-wrap gap-2">
            {STATUSES.map((s) => (
              <span key={s} className="inline-flex items-center gap-1">
                <button
                  type="button"
                  aria-pressed={form.status === s}
                  onClick={() => set('status', s)}
                  className={statusToggleClass(form.status === s)}
                >
                  {t(`status.${s}`)}
                </button>
                <InfoTip label={t(`status.${s}`)}>{tG(`status.${s}`)}</InfoTip>
              </span>
            ))}
          </div>
        </div>
        {countabilityChanged && (
          <ConsequenceNote>{tG(`status.${form.status}`)}</ConsequenceNote>
        )}

        <RequiredNote />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {tCommon('actions.cancel')}
          </Button>
          <Button type="submit" loading={saving}>
            {t('form.saveSubmit')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
