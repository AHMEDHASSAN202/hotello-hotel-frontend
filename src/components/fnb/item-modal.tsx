'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { RequiredNote } from '@/components/guidance';
import { Button, Field, Modal } from '@/components/ui';
import { api, apiUpload, assetUrl } from '@/lib/api';
import { useApiError } from '@/lib/errors';
import type {
  FnbItemManage,
  FnbMenuManage,
  StayType,
} from '@/lib/types';
import { STAY_TYPES } from '@/lib/types';
import {
  fieldsToPayload,
  NameFields,
  NameFieldValues,
  namesToFields,
} from '@/components/name-fields';
import { isValidPhoto, PhotoPicker } from '@/components/photo-picker';

type PricingMode = 'inherit' | 'paid' | 'included';

interface OptionRow {
  nameEn: string;
  nameAr: string;
  price: string;
}

/**
 * 16.2 AC2–AC5 — item editor: names/descriptions ×7, photo (upload via the
 * storage driver, tasteful placeholder if absent), price, pricing mode
 * (inherit / always paid / included-for), one simple variant group, notes
 * toggle, active.
 */
export function ItemModal({
  menu,
  sectionId,
  item,
  open,
  onClose,
  onSaved,
}: {
  menu: FnbMenuManage;
  sectionId: string;
  item: FnbItemManage | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations('fnb.menus.itemModal');
  const tStayTypes = useTranslations('stays.stayTypes');
  const tCommon = useTranslations('common');
  const resolveError = useApiError();

  const [names, setNames] = useState<NameFieldValues>({});
  const [price, setPrice] = useState('');
  const [pricingMode, setPricingMode] = useState<PricingMode>('inherit');
  const [includedFor, setIncludedFor] = useState<StayType[]>([]);
  const [hasVariant, setHasVariant] = useState(false);
  const [variantLabelEn, setVariantLabelEn] = useState('');
  const [variantLabelAr, setVariantLabelAr] = useState('');
  const [options, setOptions] = useState<OptionRow[]>([]);
  const [allowNotes, setAllowNotes] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setNames(namesToFields(item?.names, item?.descriptions));
    setPrice(item ? String(item.price) : '');
    setPricingMode(
      item?.includedFor === null || item === null
        ? 'inherit'
        : item.includedFor.length === 0
          ? 'paid'
          : 'included',
    );
    setIncludedFor((item?.includedFor as StayType[]) ?? []);
    setHasVariant(Boolean(item?.variant));
    setVariantLabelEn(item?.variant?.label.en ?? '');
    setVariantLabelAr(item?.variant?.label.ar ?? '');
    setOptions(
      item?.variant?.options.map((o) => ({
        nameEn: o.names.en ?? '',
        nameAr: o.names.ar ?? '',
        price: String(o.price),
      })) ?? [],
    );
    setAllowNotes(item?.allowNotes ?? true);
    setIsActive(item?.isActive ?? true);
    setPhotoFile(null);
    setPhotoError(null);
    setRemovePhoto(false);
    setError(null);
  }, [open, item]);

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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        ...fieldsToPayload(names, true),
        price: Number(price),
        includedFor:
          pricingMode === 'inherit'
            ? null
            : pricingMode === 'paid'
              ? []
              : includedFor,
        variant:
          hasVariant && options.length > 0
            ? {
                nameEn: variantLabelEn.trim(),
                nameAr: variantLabelAr.trim(),
                options: options.map((o) => ({
                  nameEn: o.nameEn.trim(),
                  nameAr: o.nameAr.trim(),
                  price: Number(o.price),
                })),
              }
            : null,
        allowNotes,
        isActive,
      };
      const saved = item
        ? await api<FnbItemManage>(`/tenant/fnb-menus/items/${item.id}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
          })
        : await api<FnbItemManage>(
            `/tenant/fnb-menus/sections/${sectionId}/items`,
            { method: 'POST', body: JSON.stringify(body) },
          );
      if (photoFile) {
        const formData = new FormData();
        formData.append('file', photoFile);
        await apiUpload(`/tenant/fnb-menus/items/${saved.id}/photo`, formData);
      } else if (removePhoto && item?.photoThumbUrl) {
        await api(`/tenant/fnb-menus/items/${saved.id}/photo`, {
          method: 'DELETE',
        });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(resolveError(err));
    } finally {
      setBusy(false);
    }
  }

  const currentPhoto =
    !removePhoto && !photoFile && item?.photoThumbUrl
      ? assetUrl(item.photoThumbUrl)
      : null;
  const menuDefaultSummary =
    menu.defaultIncludedFor.length > 0
      ? menu.defaultIncludedFor.map((type) => tStayTypes(type)).join('، ')
      : t('pricingPaid');

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={item ? t('editTitle') : t('createTitle')}
      wide
    >
      <form onSubmit={submit} className="space-y-4">
        <NameFields
          values={names}
          onChange={(k, v) => setNames((s) => ({ ...s, [k]: v }))}
          withDescriptions
        />

        {/* Photo (spec note 6) */}
        <PhotoPicker
          label={t('photoLabel')}
          hint={t('photoHint')}
          currentUrl={currentPhoto}
          pending={photoFile}
          canRemove={Boolean(item?.photoThumbUrl && !removePhoto)}
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

        <Field
          label={t('priceLabel')}
          hint={t('priceHint')}
          type="number"
          inputMode="decimal"
          step="0.01"
          min={0}
          required
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />

        {/* 16.2 AC3 — pricing mode with per-item override */}
        <div>
          <span className="mb-1 block text-sm font-medium text-ink">
            {t('pricingLabel')}
          </span>
          <div className="flex flex-wrap gap-3">
            {(
              [
                ['inherit', t('pricingInherit')],
                ['paid', t('pricingPaid')],
                ['included', t('pricingIncluded')],
              ] as const
            ).map(([mode, label]) => (
              <label key={mode} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="item-pricing"
                  checked={pricingMode === mode}
                  onChange={() => setPricingMode(mode)}
                />
                {label}
              </label>
            ))}
          </div>
          {pricingMode === 'inherit' ? (
            <p className="mt-1 text-xs text-ink-soft">
              {t('pricingInheritNote', { summary: menuDefaultSummary })}
            </p>
          ) : null}
          {pricingMode === 'included' ? (
            <div className="mt-2 flex flex-wrap gap-3">
              {STAY_TYPES.map((type) => (
                <label key={type} className="flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
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

        {/* 16.2 AC4 — one simple variant group */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-ink">
            <input
              type="checkbox"
              checked={hasVariant}
              onChange={(e) => {
                setHasVariant(e.target.checked);
                if (e.target.checked && options.length === 0) {
                  setOptions([{ nameEn: '', nameAr: '', price: '' }]);
                }
              }}
            />
            {t('variantEnable')}
          </label>
          <p className="mt-1 text-xs text-ink-soft">{t('variantHint')}</p>
          {hasVariant ? (
            <div className="mt-2 space-y-2 rounded-lg border border-line p-3">
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label={t('variantGroupNameEn')}
                  required
                  value={variantLabelEn}
                  onChange={(e) => setVariantLabelEn(e.target.value)}
                />
                <Field
                  label={t('variantGroupNameAr')}
                  required
                  dir="rtl"
                  value={variantLabelAr}
                  onChange={(e) => setVariantLabelAr(e.target.value)}
                />
              </div>
              {options.map((option, i) => (
                <div key={i} className="flex items-end gap-2">
                  <Field
                    label={t('optionNameEn')}
                    required
                    value={option.nameEn}
                    onChange={(e) =>
                      setOptions((os) =>
                        os.map((x, j) =>
                          j === i ? { ...x, nameEn: e.target.value } : x,
                        ),
                      )
                    }
                  />
                  <Field
                    label={t('optionNameAr')}
                    required
                    dir="rtl"
                    value={option.nameAr}
                    onChange={(e) =>
                      setOptions((os) =>
                        os.map((x, j) =>
                          j === i ? { ...x, nameAr: e.target.value } : x,
                        ),
                      )
                    }
                  />
                  <Field
                    label={t('optionPrice')}
                    type="number"
                    step="0.01"
                    min={0}
                    required
                    value={option.price}
                    onChange={(e) =>
                      setOptions((os) =>
                        os.map((x, j) =>
                          j === i ? { ...x, price: e.target.value } : x,
                        ),
                      )
                    }
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setOptions((os) => os.filter((_, j) => j !== i))
                    }
                    className="mb-2 shrink-0 text-sm text-danger underline-offset-2 hover:underline"
                  >
                    {t('removeOption')}
                  </button>
                </div>
              ))}
              {options.length < 6 ? (
                <button
                  type="button"
                  onClick={() =>
                    setOptions((os) => [...os, { nameEn: '', nameAr: '', price: '' }])
                  }
                  className="text-sm font-medium text-ink underline-offset-2 hover:underline"
                >
                  {t('addOption')}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* 16.2 AC5 — notes toggle */}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={allowNotes}
            onChange={(e) => setAllowNotes(e.target.checked)}
          />
          <span>
            {t('notesLabel')}
            <span className="ms-2 text-xs text-ink-soft">{t('notesHint')}</span>
          </span>
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          {t('activeLabel')}
        </label>

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
          <Button
            type="submit"
            loading={busy}
            disabled={
              !names.nameEn?.trim() ||
              !names.nameAr?.trim() ||
              price === '' ||
              (hasVariant &&
                (options.length === 0 ||
                  !variantLabelEn.trim() ||
                  !variantLabelAr.trim() ||
                  options.some(
                    (o) => !o.nameEn.trim() || !o.nameAr.trim() || o.price === '',
                  )))
            }
          >
            {item ? t('save') : t('create')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
