'use client';

import { useLocale, useTranslations } from 'next-intl';
import { FormEvent, useEffect, useState } from 'react';
import { InfoTip, RequiredNote } from '@/components/guidance';
import { Button, Code, Field, Modal, selectClass } from '@/components/ui';
import type { Locale } from '@/i18n/config';
import { api, ApiError } from '@/lib/api';
import { useApiError } from '@/lib/errors';
import { roomIssueMessage } from '@/lib/room-issues';
import type { BulkPreview, RoomStatus, RoomType } from '@/lib/types';

type Tab = 'single' | 'bulk';

const EMPTY_SINGLE = {
  roomNumber: '',
  floor: '',
  roomTypeId: '',
  status: 'active' as RoomStatus,
};

const EMPTY_BULK = {
  floor: '',
  roomTypeId: '',
  from: '',
  to: '',
  exclusions: '',
};

/**
 * Comma-separated integers ("313, 413" → [313, 413]) — blanks and non-numeric
 * entries are silently dropped rather than rejected; the field's hint
 * explains the format instead of the input scolding the user for it.
 */
function parseExclusions(raw: string): number[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number)
    .filter((n) => Number.isInteger(n));
}

const statusToggleClass = (active: boolean) =>
  `rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
    active
      ? 'border-ink bg-ink text-white'
      : 'border-line bg-white text-ink-soft hover:text-ink'
  }`;

/**
 * Story 11.3 — add rooms, one at a time or as a numeric range. The bulk tab
 * is a two-step flow: fill the range and preview it (the backend flags
 * duplicate numbers and invalid rows), then confirm. Confirming always means
 * "skip duplicates and create the rest" (11.3 AC2) — there is no silent
 * overwrite path, only that or cancel.
 */
export function AddRoomsModal({
  open,
  types,
  onClose,
  onCreated,
}: {
  open: boolean;
  types: RoomType[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const t = useTranslations('rooms');
  const tCommon = useTranslations('common');
  const tG = useTranslations('guidance.rooms');
  const resolveError = useApiError();
  const locale = useLocale() as Locale;

  const activeTypes = types.filter((rt) => rt.isActive);
  const typeName = (rt: RoomType) => (locale === 'ar' ? rt.nameAr : rt.nameEn);

  const [tab, setTab] = useState<Tab>('single');

  // Single room
  const [singleForm, setSingleForm] = useState(EMPTY_SINGLE);
  const [singleError, setSingleError] = useState<string | null>(null);
  const [singleErrorRemaining, setSingleErrorRemaining] = useState<
    number | null
  >(null);
  const [singleFieldErrors, setSingleFieldErrors] = useState<{
    roomNumber?: string;
  }>({});
  const [singleSaving, setSingleSaving] = useState(false);

  // Bulk range
  const [bulkForm, setBulkForm] = useState(EMPTY_BULK);
  const [bulkStep, setBulkStep] = useState<'form' | 'preview'>('form');
  const [bulkPreview, setBulkPreview] = useState<BulkPreview | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkErrorRemaining, setBulkErrorRemaining] = useState<number | null>(
    null,
  );
  const [previewing, setPreviewing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (open) {
      const firstType = activeTypes[0]?.id ?? '';
      setTab('single');
      setSingleForm({ ...EMPTY_SINGLE, roomTypeId: firstType });
      setSingleError(null);
      setSingleErrorRemaining(null);
      setSingleFieldErrors({});
      setSingleSaving(false);
      setBulkForm({ ...EMPTY_BULK, roomTypeId: firstType });
      setBulkStep('form');
      setBulkPreview(null);
      setBulkError(null);
      setBulkErrorRemaining(null);
      setPreviewing(false);
      setConfirming(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function setSingle<K extends keyof typeof singleForm>(
    key: K,
    value: (typeof singleForm)[K],
  ) {
    setSingleForm((f) => ({ ...f, [key]: value }));
  }

  function setBulk<K extends keyof typeof bulkForm>(
    key: K,
    value: (typeof bulkForm)[K],
  ) {
    setBulkForm((f) => ({ ...f, [key]: value }));
  }

  /** Shared 409 ROOM_LIMIT_REACHED handling — resolved message plus the
   * remaining-seats count from `err.details`, rendered as a second line so
   * the conversion copy reads as guidance, not just an error. */
  function applyLimitError(
    err: ApiError,
    setMessage: (v: string | null) => void,
    setRemaining: (v: number | null) => void,
  ) {
    setMessage(resolveError(err));
    const remaining = (err.details as { remaining?: number } | undefined)
      ?.remaining;
    setRemaining(typeof remaining === 'number' ? remaining : null);
  }

  async function handleSingleSubmit(e: FormEvent) {
    e.preventDefault();
    setSingleSaving(true);
    setSingleError(null);
    setSingleErrorRemaining(null);
    setSingleFieldErrors({});
    try {
      await api('/tenant/rooms', {
        method: 'POST',
        body: JSON.stringify({
          roomNumber: singleForm.roomNumber,
          floor: singleForm.floor ? Number(singleForm.floor) : undefined,
          roomTypeId: singleForm.roomTypeId,
          status: singleForm.status,
        }),
      });
      onCreated();
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'ROOM_NUMBER_TAKEN') {
        setSingleFieldErrors({ roomNumber: resolveError(err) });
      } else if (
        err instanceof ApiError &&
        err.code === 'ROOM_LIMIT_REACHED'
      ) {
        applyLimitError(err, setSingleError, setSingleErrorRemaining);
      } else {
        setSingleError(resolveError(err));
      }
    } finally {
      setSingleSaving(false);
    }
  }

  async function handlePreview(e: FormEvent) {
    e.preventDefault();
    setPreviewing(true);
    setBulkError(null);
    setBulkErrorRemaining(null);
    try {
      const exclusions = parseExclusions(bulkForm.exclusions);
      const res = await api<BulkPreview>('/tenant/rooms/bulk/preview', {
        method: 'POST',
        body: JSON.stringify({
          from: Number(bulkForm.from),
          to: Number(bulkForm.to),
          ...(exclusions.length ? { exclusions } : {}),
          ...(bulkForm.floor ? { floor: Number(bulkForm.floor) } : {}),
          roomTypeId: bulkForm.roomTypeId,
        }),
      });
      setBulkPreview(res);
      setBulkStep('preview');
    } catch (err) {
      setBulkError(resolveError(err));
    } finally {
      setPreviewing(false);
    }
  }

  async function handleConfirm() {
    if (!bulkPreview) return;
    setConfirming(true);
    setBulkError(null);
    setBulkErrorRemaining(null);
    try {
      // 11.3 AC2 — confirming a bulk range always skips duplicates and
      // creates the rest; only valid, non-duplicate rows are ever posted.
      const included = bulkPreview.rows.filter(
        (r) => !r.duplicate && r.issues.length === 0,
      );
      await api('/tenant/rooms/bulk', {
        method: 'POST',
        body: JSON.stringify({
          rooms: included.map((r) => ({
            row: r.row,
            roomNumber: r.roomNumber,
            floor: r.floor,
            roomTypeId: r.roomTypeId,
            status: r.status,
          })),
          source: 'range',
          skipDuplicates: true,
          skippedCount: bulkPreview.rows.length - included.length,
          range: { from: Number(bulkForm.from), to: Number(bulkForm.to) },
        }),
      });
      onCreated();
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'ROOM_LIMIT_REACHED') {
        applyLimitError(err, setBulkError, setBulkErrorRemaining);
      } else {
        setBulkError(resolveError(err));
      }
    } finally {
      setConfirming(false);
    }
  }

  const tabClass = (m: Tab) =>
    `flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
      tab === m ? 'bg-ink text-white' : 'bg-paper text-ink-soft hover:text-ink'
    }`;

  const typeSelect = (
    value: string,
    onChange: (id: string) => void,
  ) => (
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
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="" disabled>
          {t('form.roomType')}
        </option>
        {activeTypes.map((rt) => (
          <option key={rt.id} value={rt.id}>
            {typeName(rt)}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <Modal open={open} onClose={onClose} title={t('form.createTitle')} wide>
      <div className="mb-4 flex gap-2 rounded-lg border border-line p-1">
        <button
          type="button"
          aria-pressed={tab === 'single'}
          className={tabClass('single')}
          onClick={() => setTab('single')}
        >
          {t('form.tabSingle')}
        </button>
        <button
          type="button"
          aria-pressed={tab === 'bulk'}
          className={tabClass('bulk')}
          onClick={() => setTab('bulk')}
        >
          {t('form.tabBulk')}
        </button>
      </div>

      <p className="mb-4 text-xs text-ink-soft">
        {tab === 'single' ? t('form.singleHint') : t('form.bulkHint')}
      </p>

      {tab === 'single' ? (
        <form onSubmit={handleSingleSubmit} className="space-y-4">
          {singleError && (
            <div
              role="alert"
              className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger"
            >
              <p>{singleError}</p>
              {singleErrorRemaining !== null && (
                <p className="mt-1">
                  {t('form.preview.remaining', {
                    count: singleErrorRemaining,
                  })}
                </p>
              )}
            </div>
          )}
          <Field
            label={t('form.roomNumber')}
            required
            dir="ltr"
            placeholder={t('form.roomNumberPlaceholder')}
            hint={t('form.roomNumberHint')}
            error={singleFieldErrors.roomNumber}
            value={singleForm.roomNumber}
            onChange={(e) => setSingle('roomNumber', e.target.value)}
          />
          <Field
            label={t('form.floorOptional')}
            type="number"
            placeholder={t('form.floorPlaceholder')}
            hint={t('form.floorHint')}
            value={singleForm.floor}
            onChange={(e) => setSingle('floor', e.target.value)}
          />
          {typeSelect(singleForm.roomTypeId, (id) =>
            setSingle('roomTypeId', id),
          )}
          <div>
            <span className="mb-1 block text-sm font-medium text-ink">
              {t('form.status')}
            </span>
            <div className="flex flex-wrap gap-2">
              {(['active', 'out_of_service'] as RoomStatus[]).map((s) => (
                <span key={s} className="inline-flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setSingle('status', s)}
                    className={statusToggleClass(singleForm.status === s)}
                  >
                    {t(`status.${s}`)}
                  </button>
                  <InfoTip label={t(`status.${s}`)}>
                    {tG(`status.${s}`)}
                  </InfoTip>
                </span>
              ))}
            </div>
          </div>
          <RequiredNote />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              {tCommon('actions.cancel')}
            </Button>
            <Button type="submit" loading={singleSaving}>
              {t('form.createSubmit')}
            </Button>
          </div>
        </form>
      ) : bulkStep === 'form' ? (
        <form onSubmit={handlePreview} className="space-y-4">
          {bulkError && (
            <div
              role="alert"
              className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger"
            >
              {bulkError}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <Field
              label={t('form.rangeFrom')}
              type="number"
              required
              placeholder={t('form.rangeFromPlaceholder')}
              value={bulkForm.from}
              onChange={(e) => setBulk('from', e.target.value)}
            />
            <Field
              label={t('form.rangeTo')}
              type="number"
              required
              placeholder={t('form.rangeToPlaceholder')}
              hint={t('form.rangeHint')}
              value={bulkForm.to}
              onChange={(e) => setBulk('to', e.target.value)}
            />
          </div>
          <Field
            label={t('form.exclusionsOptional')}
            dir="ltr"
            placeholder={t('form.exclusionsPlaceholder')}
            hint={t('form.exclusionsHint')}
            value={bulkForm.exclusions}
            onChange={(e) => setBulk('exclusions', e.target.value)}
          />
          <Field
            label={t('form.floorOptional')}
            type="number"
            placeholder={t('form.floorPlaceholder')}
            hint={t('form.floorHint')}
            value={bulkForm.floor}
            onChange={(e) => setBulk('floor', e.target.value)}
          />
          {typeSelect(bulkForm.roomTypeId, (id) => setBulk('roomTypeId', id))}
          <RequiredNote />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              {tCommon('actions.cancel')}
            </Button>
            <Button type="submit" loading={previewing}>
              {t('form.preview.title')}
            </Button>
          </div>
        </form>
      ) : (
        bulkPreview && (
          <div className="space-y-4">
            <p className="text-xs text-ink-soft">{tG('bulkPreviewNote')}</p>

            <div className="rounded-xl border border-gold/40 bg-gold-soft px-4 py-3 text-sm text-ink">
              <p className="font-semibold">
                {t('form.preview.willCreate', {
                  count: bulkPreview.validCount,
                })}
              </p>
              <p className="mt-1">
                {bulkPreview.remaining === null
                  ? t('form.preview.unlimited')
                  : t('form.preview.remaining', {
                      count: bulkPreview.remaining,
                    })}
              </p>
              {bulkPreview.duplicateCount > 0 && (
                <p className="mt-1">
                  {t('form.preview.duplicateCount', {
                    count: bulkPreview.duplicateCount,
                  })}
                </p>
              )}
              {bulkPreview.invalidCount > 0 && (
                <p className="mt-1">
                  {t('form.preview.invalidCount', {
                    count: bulkPreview.invalidCount,
                  })}
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2 rounded-lg border border-line bg-paper p-3">
              {bulkPreview.rows.map((row) => (
                <Code
                  key={row.row}
                  title={
                    row.duplicate
                      ? t('form.preview.duplicateBadge')
                      : undefined
                  }
                  className={`rounded border border-line bg-white px-2 py-1 ${
                    row.duplicate
                      ? 'line-through text-ink-soft'
                      : row.issues.length > 0
                        ? 'text-danger'
                        : 'text-ink'
                  }`}
                >
                  {row.roomNumber}
                </Code>
              ))}
            </div>

            {bulkPreview.rows.some((r) => r.issues.length > 0) && (
              <ul className="space-y-1 text-xs text-danger">
                {bulkPreview.rows
                  .filter((r) => r.issues.length > 0)
                  .flatMap((r) =>
                    r.issues.map((issue, i) => (
                      <li key={`${r.row}-${issue.field}-${i}`}>
                        {t('form.preview.rowNumber', { row: r.row })}
                        {': '}
                        {roomIssueMessage(t, issue)}
                      </li>
                    )),
                  )}
              </ul>
            )}

            {bulkError && (
              <div
                role="alert"
                className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger"
              >
                <p>{bulkError}</p>
                {bulkErrorRemaining !== null && (
                  <p className="mt-1">
                    {t('form.preview.remaining', {
                      count: bulkErrorRemaining,
                    })}
                  </p>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={onClose}>
                {tCommon('actions.cancel')}
              </Button>
              <Button
                type="button"
                disabled={bulkPreview.validCount === 0}
                loading={confirming}
                onClick={handleConfirm}
              >
                {t('form.preview.confirmCount', {
                  count: bulkPreview.validCount,
                })}
              </Button>
            </div>
          </div>
        )
      )}
    </Modal>
  );
}
