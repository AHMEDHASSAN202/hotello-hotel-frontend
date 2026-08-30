'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { RequiredNote } from '@/components/guidance';
import { useTenant } from '@/components/tenant-provider';
import { Button, Field, Modal, selectClass } from '@/components/ui';
import { api, apiUpload, assetUrl } from '@/lib/api';
import { useApiError } from '@/lib/errors';
import {
  fieldsToPayload,
  NameFields,
  NameFieldValues,
  namesToFields,
} from '@/components/name-fields';
import { isValidPhoto, PhotoPicker } from '@/components/photo-picker';
import { STAY_TYPES } from '@/lib/types';
import type {
  HotelInfoOverview,
  InfoEntryManage,
  StayType,
  TenantEvent,
} from '@/lib/types';

/**
 * Epic 21, Story 21.2 AC1/AC2 — event create/edit. The 3-way pricing radio
 * is a UI simplification of the two backend fields (`event-pricing.ts`):
 * `free` → price 0 / includedFor []; `paid` → price / includedFor [];
 * `included` → price / includedFor [selected]. Unlike F&B there is no
 * "inherit" third state — Events have no parent default to fall back to.
 */
type PricingMode = 'free' | 'paid' | 'included';

/**
 * Mirrors `events.constants.ts` (`EVENT_TITLE_MAX` / `EVENT_DESCRIPTION_MAX` /
 * `EVENT_LOCATION_TEXT_MAX`) — the `@MaxLength` caps on `CreateEventDto`.
 * Capping the inputs turns a 400 round-trip into a field that simply stops
 * accepting characters (the locationText/cancel-reason precedent).
 */
const TITLE_MAX = 120;
const DESCRIPTION_MAX = 2000;
const LOCATION_MAX = 200;

/** 'YYYY-MM-DD HH:MM' stamp → the two inputs (the announcements ScheduleFields convention). */
function stampToParts(stamp: string | null): { date: string; time: string } {
  if (!stamp) return { date: '', time: '' };
  const [date, time] = stamp.split(' ');
  return { date: date ?? '', time: time ?? '' };
}

function flattenInfoEntries(overview: HotelInfoOverview): InfoEntryManage[] {
  return [
    ...(overview.essentials ? [overview.essentials] : []),
    ...overview.facilities,
    ...overview.services,
    ...overview.houseRules,
    ...(overview.about ? [overview.about] : []),
  ];
}

/**
 * `NameFields`/`fieldsToPayload` are built around the F&B/hotel-info
 * `name*`/`description*` DTO convention — but `CreateEventDto`/
 * `UpdateEventDto` name the title fields `titleEn`/`titleAr`/`titleRu`…
 * (`create-event.dto.ts`, `update-event.dto.ts`; `TenantEventsService.mergeTitles`
 * reads `dto.titleEn`/`dto.titleAr`). Remap the `name*` keys to `title*` here,
 * local to this caller, rather than touching the shared component — every
 * other `NameFields` caller (F&B, hotel-info, branding) is on the `name*`
 * convention and must stay untouched. `description*` keys already match the
 * backend as-is and pass through unchanged.
 *
 * `previous` (the values the modal opened with / last saved) lets
 * `fieldsToPayload` emit `''` for an optional language the user just
 * blanked, so the clear actually reaches `mergeTranslations` instead of
 * being omitted — and therefore kept — server-side.
 */
function toEventContentPayload(
  names: NameFieldValues,
  previous: NameFieldValues,
): Record<string, string> {
  const raw = fieldsToPayload(names, true, { previous });
  const payload: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    payload[key.startsWith('name') ? `title${key.slice(4)}` : key] = value;
  }
  return payload;
}

export function EventModal({
  event,
  open,
  onClose,
  onSaved,
}: {
  /** Null = create mode. */
  event: TenantEvent | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations('events.form');
  const tStayTypes = useTranslations('stays.stayTypes');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const resolveError = useApiError();
  const { isModuleEnabled, hasPermission } = useTenant();

  /**
   * Story 21.2 AC1 — the safe-edit matrix: once published, guests may
   * already be booked against the schedule/price/location, so those fields
   * lock (mirrors `tenant-events.service.ts`'s `assertEditable` exactly —
   * its `touchesRestricted` list also covers location/infoEntryId, not just
   * start/end/price/pricing). Titles, descriptions, photo and
   * capacity-increases stay open. Restricted keys are omitted from the PATCH
   * body entirely below — the service keys off "field present in the DTO",
   * not "value changed", so merely disabling the input isn't enough.
   */
  const isPublished = event?.status === 'published';
  const currentCapacity = event?.capacity ?? null;

  const [names, setNames] = useState<NameFieldValues>({});
  /**
   * The titles/descriptions as last persisted — the comparison basis that
   * lets a blanked optional language ride the payload as `''` (see
   * `toEventContentPayload`). Refreshed after every successful save so a
   * second save in the same modal session compares against the truth.
   */
  const [savedNames, setSavedNames] = useState<NameFieldValues>({});
  /**
   * Review fix (Important) — the create flow is two requests (POST the
   * event, then upload its photo). If the upload failed, the modal stayed in
   * create mode and pressing Create again POSTed a SECOND event. Once the
   * POST has succeeded we remember its id and every later submit in this
   * session PATCHes that event (and retries the photo) instead.
   */
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [locationText, setLocationText] = useState('');
  const [infoEntryId, setInfoEntryId] = useState('');
  const [infoEntries, setInfoEntries] = useState<InfoEntryManage[]>([]);
  const [unlimited, setUnlimited] = useState(true);
  const [capacity, setCapacity] = useState('');
  const [capacityError, setCapacityError] = useState<string | null>(null);
  const [price, setPrice] = useState('0');
  const [pricingMode, setPricingMode] = useState<PricingMode>('free');
  const [includedFor, setIncludedFor] = useState<StayType[]>([]);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hotel Info entries require their own module + permission — the picker is
  // simply absent (not a broken empty dropdown) when either is missing.
  const canLinkInfoEntry =
    isModuleEnabled('hotel_info') && hasPermission('hotel_info.manage');

  useEffect(() => {
    if (!open) return;
    const initialNames = namesToFields(event?.titles, event?.descriptions);
    setNames(initialNames);
    setSavedNames(initialNames);
    setCreatedId(null);
    const start = stampToParts(event?.startAtLocal ?? null);
    setStartDate(start.date);
    setStartTime(start.time);
    const end = stampToParts(event?.endAtLocal ?? null);
    setEndDate(end.date);
    setEndTime(end.time);
    setLocationText(event?.locationText ?? '');
    setInfoEntryId(event?.infoEntryId ?? '');
    setUnlimited(event ? event.capacity === null : true);
    setCapacity(event?.capacity != null ? String(event.capacity) : '');
    setPrice(event ? String(event.price) : '0');
    // Final-review fix (Minor) — check `includedFor` BEFORE `price === 0`:
    // an event saved as "included for selected stay types" is allowed to
    // have price 0 (the form permits it), and the old order re-derived that
    // as 'free' on reopen, silently dropping the includedFor selection on
    // the next save.
    setPricingMode(
      !event
        ? 'free'
        : event.includedFor.length > 0
          ? 'included'
          : event.price === 0
            ? 'free'
            : 'paid',
    );
    setIncludedFor(event?.includedFor ?? []);
    setPhotoFile(null);
    setPhotoError(null);
    setRemovePhoto(false);
    setCapacityError(null);
    setError(null);
  }, [open, event]);

  useEffect(() => {
    if (!open || !canLinkInfoEntry) {
      setInfoEntries([]);
      return;
    }
    let cancelled = false;
    void api<HotelInfoOverview>('/tenant/hotel-info')
      .then((overview) => {
        if (!cancelled) setInfoEntries(flattenInfoEntries(overview));
      })
      .catch(() => {
        if (!cancelled) setInfoEntries([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, canLinkInfoEntry]);

  function pickPhoto(file: File | undefined) {
    setPhotoError(null);
    if (!file) return;
    if (!isValidPhoto(file)) {
      setPhotoError(t('photoInvalid'));
      return;
    }
    setPhotoFile(file);
    setRemovePhoto(false);
  }

  function selectPricingMode(mode: PricingMode) {
    setPricingMode(mode);
    if (mode === 'free') setPrice('0');
    if (mode !== 'included') setIncludedFor([]);
  }

  function toggleUnlimited(checked: boolean) {
    setUnlimited(checked);
    setCapacityError(null);
    if (checked) setCapacity('');
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCapacityError(null);

    if ((endDate && !endTime) || (!endDate && endTime)) {
      setError(t('endIncomplete'));
      return;
    }
    // Review fix (Important) — this guard belongs to the PUBLISHED half of
    // the safe-edit matrix only. `assertEditable` returns early for drafts
    // (`event.status === 'draft'` → everything editable), so blocking a
    // draft's capacity decrease invented a rule the backend doesn't have —
    // and told the user "this event is live" about an unpublished draft.
    if (
      isPublished &&
      !unlimited &&
      currentCapacity !== null &&
      capacity !== '' &&
      Number(capacity) < currentCapacity
    ) {
      setCapacityError(
        t('capacityDecreaseError', { current: currentCapacity }),
      );
      return;
    }

    setBusy(true);
    let createdNow = false;
    try {
      const body: Record<string, unknown> = {
        ...toEventContentPayload(names, savedNames),
        // Always capacity-safe server-side (increase-or-equal, or switching
        // to unlimited) — never gated behind isPublished.
        capacity: unlimited ? null : Number(capacity),
      };
      if (!isPublished) {
        body.startAtLocal = `${startDate} ${startTime}`;
        body.endAtLocal = endDate && endTime ? `${endDate} ${endTime}` : null;
        body.locationText = locationText.trim();
        body.infoEntryId = infoEntryId || null;
        body.price = pricingMode === 'free' ? 0 : Number(price);
        body.includedFor = pricingMode === 'included' ? includedFor : [];
      }
      // `createdId` makes the retry of a half-finished create an UPDATE of
      // the event we already created, never a duplicate POST.
      const targetId = event?.id ?? createdId;
      const saved = targetId
        ? await api<TenantEvent>(`/tenant/events/${targetId}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
          })
        : await api<TenantEvent>('/tenant/events', {
            method: 'POST',
            body: JSON.stringify(body),
          });
      const savedId = saved.id ?? targetId;
      if (!targetId) {
        createdNow = true;
        setCreatedId(savedId);
      }
      setSavedNames(names);
      if (photoFile) {
        const formData = new FormData();
        formData.append('file', photoFile);
        await apiUpload(`/tenant/events/${savedId}/photo`, formData);
      } else if (removePhoto && event?.photoThumbUrl) {
        await api(`/tenant/events/${savedId}/photo`, { method: 'DELETE' });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(resolveError(err));
      // Create succeeded, the photo step didn't: the event DOES exist, so
      // refresh the list — closing the modal now must not hide it.
      if (createdNow) onSaved();
    } finally {
      setBusy(false);
    }
  }

  const currentPhoto =
    !removePhoto && !photoFile && event?.photoThumbUrl
      ? assetUrl(event.photoThumbUrl)
      : null;

  const infoEntryLabel = (entry: InfoEntryManage) =>
    (locale === 'ar' ? entry.names.ar : entry.names.en) ?? entry.names.en ?? '';

  const requiredFilled = Boolean(
    names.nameEn?.trim() &&
      names.nameAr?.trim() &&
      names.descriptionEn?.trim() &&
      names.descriptionAr?.trim() &&
      startDate &&
      startTime &&
      locationText.trim() &&
      (unlimited || capacity !== '') &&
      (pricingMode === 'free' || price !== '') &&
      (pricingMode !== 'included' || includedFor.length > 0),
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={event ? t('editTitle') : t('createTitle')}
      wide
    >
      <form onSubmit={submit} className="space-y-4">
        <NameFields
          values={names}
          onChange={(k, v) => setNames((s) => ({ ...s, [k]: v }))}
          withDescriptions
          descriptionsRequired
          maxLength={TITLE_MAX}
          descriptionMaxLength={DESCRIPTION_MAX}
          namespace="events.form.names"
        />

        <PhotoPicker
          label={t('photoLabel')}
          hint={t('photoHint')}
          currentUrl={currentPhoto}
          pending={photoFile}
          canRemove={Boolean(event?.photoThumbUrl && !removePhoto)}
          uploadLabel={t('photoUpload')}
          replaceLabel={t('photoReplace')}
          removeLabel={t('photoRemove')}
          error={photoError}
          onPick={pickPhoto}
          onRemove={() => {
            setRemovePhoto(true);
            setPhotoFile(null);
          }}
        />

        {isPublished ? (
          <p className="rounded-lg border border-line bg-paper px-3 py-2 text-xs text-ink-soft">
            {t('safeEditNote')}
          </p>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <Field
            label={t('startDate')}
            type="date"
            required
            disabled={isPublished}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <Field
            label={t('startTime')}
            type="time"
            required
            disabled={isPublished}
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field
            label={t('endDate')}
            hint={t('endHint')}
            type="date"
            disabled={isPublished}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
          <Field
            label={t('endTime')}
            type="time"
            disabled={isPublished}
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
          />
        </div>

        <Field
          label={t('locationLabel')}
          required
          disabled={isPublished}
          maxLength={LOCATION_MAX}
          value={locationText}
          onChange={(e) => setLocationText(e.target.value)}
        />

        {canLinkInfoEntry && infoEntries.length > 0 ? (
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-ink">
              {t('infoEntryLabel')}
            </span>
            <select
              disabled={isPublished}
              className={`${selectClass} w-full`}
              value={infoEntryId}
              onChange={(e) => setInfoEntryId(e.target.value)}
            >
              <option value="">{t('infoEntryNone')}</option>
              {infoEntries.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {infoEntryLabel(entry)}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-ink-soft">
              {t('infoEntryHint')}
            </span>
          </label>
        ) : null}

        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-ink">
            <input
              type="checkbox"
              checked={unlimited}
              onChange={(e) => toggleUnlimited(e.target.checked)}
            />
            {t('unlimitedLabel')}
          </label>
          {!unlimited ? (
            <div className="mt-2">
              <Field
                label={t('capacityLabel')}
                type="number"
                inputMode="numeric"
                min={isPublished && currentCapacity ? currentCapacity : 1}
                required
                value={capacity}
                onChange={(e) => {
                  setCapacity(e.target.value);
                  setCapacityError(null);
                }}
                error={capacityError ?? undefined}
              />
            </div>
          ) : null}
        </div>

        <Field
          label={t('priceLabel')}
          hint={t('priceHint')}
          type="number"
          inputMode="decimal"
          step="0.01"
          min={0}
          required
          disabled={isPublished || pricingMode === 'free'}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />

        <div>
          <span className="mb-1 block text-sm font-medium text-ink">
            {t('pricingLabel')}
          </span>
          <div className="flex flex-wrap gap-3">
            {(
              [
                ['free', t('pricingFree')],
                ['paid', t('pricingPaid')],
                ['included', t('pricingIncluded')],
              ] as const
            ).map(([mode, label]) => (
              <label key={mode} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="event-pricing"
                  disabled={isPublished}
                  checked={pricingMode === mode}
                  onChange={() => selectPricingMode(mode)}
                />
                {label}
              </label>
            ))}
          </div>
          {pricingMode === 'included' ? (
            <div className="mt-2 flex flex-wrap gap-3">
              {STAY_TYPES.map((type) => (
                <label key={type} className="flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    disabled={isPublished}
                    checked={includedFor.includes(type)}
                    onChange={(e) =>
                      setIncludedFor((prev) =>
                        e.target.checked
                          ? [...prev, type]
                          : prev.filter((x) => x !== type),
                      )
                    }
                  />
                  {tStayTypes(type)}
                </label>
              ))}
            </div>
          ) : null}
        </div>

        <RequiredNote />
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {tCommon('actions.cancel')}
          </Button>
          <Button type="submit" loading={busy} disabled={!requiredFilled}>
            {event ? t('save') : t('create')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
