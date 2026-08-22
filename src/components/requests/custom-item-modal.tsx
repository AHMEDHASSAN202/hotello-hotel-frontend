'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { RequiredNote } from '@/components/guidance';
import { Button, Field, Modal, selectClass } from '@/components/ui';
import { api } from '@/lib/api';
import { useApiError } from '@/lib/errors';
import type { CatalogItemManage, RequestOptionType } from '@/lib/types';

const EXTRA_LANGS = ['ru', 'fr', 'it', 'es', 'de'] as const;

/**
 * Custom item create/edit (15.1 AC4): AR + EN mandatory, the other five
 * languages optional (guests fall back to EN per field), one simple option,
 * SLA target required on create. Content edits are custom-items-only —
 * platform items never open this modal.
 */
export function CustomItemModal({
  categoryId,
  item,
  onClose,
  onSaved,
}: {
  categoryId: string;
  /** Null = create; a custom item = edit its content. */
  item: CatalogItemManage | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations('requests.customItem');
  const tCommon = useTranslations('common');
  const resolveError = useApiError();

  const [nameEn, setNameEn] = useState(item?.names.en ?? '');
  const [nameAr, setNameAr] = useState(item?.names.ar ?? '');
  const [extraNames, setExtraNames] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      EXTRA_LANGS.map((lang) => [lang, item?.names[lang] ?? '']),
    ),
  );
  const [descriptionEn, setDescriptionEn] = useState(
    item?.descriptions?.en ?? '',
  );
  const [descriptionAr, setDescriptionAr] = useState(
    item?.descriptions?.ar ?? '',
  );
  const [optionType, setOptionType] = useState<RequestOptionType | ''>(
    item?.optionType ?? '',
  );
  const [optionMin, setOptionMin] = useState(String(item?.optionMin ?? 1));
  const [optionMax, setOptionMax] = useState(String(item?.optionMax ?? 4));
  const [slaMinutes, setSlaMinutes] = useState(
    String(item?.slaMinutes ?? 30),
  );
  const [showExtra, setShowExtra] = useState(
    EXTRA_LANGS.some((lang) => Boolean(item?.names[lang])),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const optionBody =
        optionType === 'quantity'
          ? {
              optionType,
              optionMin: parseInt(optionMin, 10),
              optionMax: parseInt(optionMax, 10),
            }
          : optionType === 'time'
            ? { optionType }
            : {};
      const namesBody: Record<string, string> = {};
      for (const lang of EXTRA_LANGS) {
        const value = extraNames[lang]?.trim();
        if (value) {
          namesBody[`name${lang[0].toUpperCase()}${lang.slice(1)}`] = value;
        }
      }
      if (item) {
        await api(`/tenant/request-catalog/items/${item.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            nameEn: nameEn.trim(),
            nameAr: nameAr.trim(),
            ...namesBody,
            ...(descriptionEn.trim()
              ? { descriptionEn: descriptionEn.trim() }
              : {}),
            ...(descriptionAr.trim()
              ? { descriptionAr: descriptionAr.trim() }
              : {}),
            ...optionBody,
          }),
        });
      } else {
        await api('/tenant/request-catalog/items', {
          method: 'POST',
          body: JSON.stringify({
            categoryId,
            nameEn: nameEn.trim(),
            nameAr: nameAr.trim(),
            ...namesBody,
            ...(descriptionEn.trim()
              ? { descriptionEn: descriptionEn.trim() }
              : {}),
            ...(descriptionAr.trim()
              ? { descriptionAr: descriptionAr.trim() }
              : {}),
            ...optionBody,
            slaMinutes: parseInt(slaMinutes, 10),
          }),
        });
      }
      onSaved();
    } catch (err) {
      setError(resolveError(err));
    } finally {
      setBusy(false);
    }
  }

  const valid =
    nameEn.trim().length > 0 &&
    nameAr.trim().length > 0 &&
    (item !== null || parseInt(slaMinutes, 10) >= 1) &&
    (optionType !== 'quantity' ||
      parseInt(optionMax, 10) > parseInt(optionMin, 10));

  return (
    <Modal
      open
      onClose={onClose}
      title={item ? t('editTitle') : t('createTitle')}
    >
      <div className="space-y-4">
        <RequiredNote />
        <Field
          label={t('nameEn')}
          required
          value={nameEn}
          onChange={(e) => setNameEn(e.target.value)}
          placeholder={t('nameEnPlaceholder')}
        />
        <Field
          label={t('nameAr')}
          required
          value={nameAr}
          onChange={(e) => setNameAr(e.target.value)}
          placeholder={t('nameArPlaceholder')}
          dir="rtl"
          hint={t('namesHelp')}
        />

        <button
          type="button"
          onClick={() => setShowExtra((v) => !v)}
          aria-expanded={showExtra}
          className="text-sm font-medium text-ink-soft underline-offset-2 hover:underline"
        >
          {showExtra ? t('hideExtraLangs') : t('showExtraLangs')}
        </button>
        {showExtra ? (
          <div className="grid grid-cols-2 gap-3">
            {EXTRA_LANGS.map((lang) => (
              <Field
                key={lang}
                label={t(`lang.${lang}`)}
                value={extraNames[lang] ?? ''}
                onChange={(e) =>
                  setExtraNames((prev) => ({
                    ...prev,
                    [lang]: e.target.value,
                  }))
                }
              />
            ))}
          </div>
        ) : null}

        <Field
          label={t('descriptionEn')}
          value={descriptionEn}
          onChange={(e) => setDescriptionEn(e.target.value)}
        />
        <Field
          label={t('descriptionAr')}
          value={descriptionAr}
          onChange={(e) => setDescriptionAr(e.target.value)}
          dir="rtl"
        />

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-ink">
            {t('optionLabel')}
          </span>
          <select
            value={optionType}
            onChange={(e) =>
              setOptionType(e.target.value as RequestOptionType | '')
            }
            className={selectClass}
          >
            <option value="">{t('optionNone')}</option>
            <option value="quantity">{t('optionQuantity')}</option>
            <option value="time">{t('optionTime')}</option>
          </select>
        </label>
        {optionType === 'quantity' ? (
          <div className="flex gap-3">
            <Field
              label={t('optionMin')}
              type="number"
              min={1}
              value={optionMin}
              onChange={(e) => setOptionMin(e.target.value)}
            />
            <Field
              label={t('optionMax')}
              type="number"
              min={1}
              value={optionMax}
              onChange={(e) => setOptionMax(e.target.value)}
            />
          </div>
        ) : null}

        {item === null ? (
          <Field
            label={t('sla')}
            required
            type="number"
            min={1}
            max={1440}
            value={slaMinutes}
            onChange={(e) => setSlaMinutes(e.target.value)}
            hint={t('slaHelp')}
          />
        ) : null}

        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>
            {tCommon('actions.cancel')}
          </Button>
          <Button onClick={save} loading={busy} disabled={!valid}>
            {item ? tCommon('actions.save') : tCommon('actions.create')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
