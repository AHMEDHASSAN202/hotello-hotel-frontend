'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Field } from '@/components/ui';
import type { RequestTranslationMap } from '@/lib/types';

/**
 * The 7-language flat-field editor (Epic 15 custom-item pattern): AR + EN
 * required, five optional behind a collapsible, optional descriptions.
 * State lives in the parent as a flat record keyed like the API DTOs
 * (nameEn, nameAr, nameRu… descriptionEn…).
 */
export const EXTRA_LANGS = ['Ru', 'Fr', 'It', 'Es', 'De'] as const;

export type NameFieldValues = Record<string, string>;

export function namesToFields(
  names: RequestTranslationMap | null | undefined,
  descriptions?: RequestTranslationMap | null,
): NameFieldValues {
  const langs = ['En', 'Ar', ...EXTRA_LANGS] as const;
  const out: NameFieldValues = {};
  for (const lang of langs) {
    const key = lang.toLowerCase() as keyof RequestTranslationMap;
    out[`name${lang}`] = names?.[key] ?? '';
    out[`description${lang}`] = descriptions?.[key] ?? '';
  }
  return out;
}

/** Only non-empty values ride the payload; EN/AR always included. */
export function fieldsToPayload(
  values: NameFieldValues,
  withDescriptions: boolean,
): Record<string, string> {
  const payload: Record<string, string> = {
    nameEn: values.nameEn?.trim() ?? '',
    nameAr: values.nameAr?.trim() ?? '',
  };
  for (const lang of EXTRA_LANGS) {
    if (values[`name${lang}`]?.trim()) {
      payload[`name${lang}`] = values[`name${lang}`].trim();
    }
  }
  if (withDescriptions) {
    for (const lang of ['En', 'Ar', ...EXTRA_LANGS]) {
      const value = values[`description${lang}`];
      if (value !== undefined && value.trim() !== '') {
        payload[`description${lang}`] = value.trim();
      }
    }
  }
  return payload;
}

export function NameFields({
  values,
  onChange,
  withDescriptions = false,
  descriptionsRequired = false,
  namespace = 'fnb.menus.names',
  maxLength,
  disabled = false,
}: {
  values: NameFieldValues;
  onChange: (key: string, value: string) => void;
  withDescriptions?: boolean;
  /** Epic 21 (events) — descriptions are AR+EN required, unlike F&B/hotel-info. */
  descriptionsRequired?: boolean;
  /** Translation namespace providing the name/description labels. */
  namespace?: string;
  /** Per-field character cap (Epic 18 welcome lines); undefined = uncapped. */
  maxLength?: number;
  /** Read-only rendering (Epic 18 locked upsell); keeps fields out of the tab order. */
  disabled?: boolean;
}) {
  const t = useTranslations(namespace);
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field
          maxLength={maxLength}
          disabled={disabled}
          label={t('nameEn')}
          hint={t('help')}
          required
          value={values.nameEn ?? ''}
          onChange={(e) => onChange('nameEn', e.target.value)}
        />
        <Field
          maxLength={maxLength}
          disabled={disabled}
          label={t('nameAr')}
          required
          dir="rtl"
          value={values.nameAr ?? ''}
          onChange={(e) => onChange('nameAr', e.target.value)}
        />
      </div>
      {withDescriptions ? (
        <div className="grid grid-cols-2 gap-3">
          <Field
            maxLength={maxLength}
            disabled={disabled}
            required={descriptionsRequired}
            label={t('descriptionEn')}
            value={values.descriptionEn ?? ''}
            onChange={(e) => onChange('descriptionEn', e.target.value)}
          />
          <Field
            maxLength={maxLength}
            disabled={disabled}
            required={descriptionsRequired}
            label={t('descriptionAr')}
            dir="rtl"
            value={values.descriptionAr ?? ''}
            onChange={(e) => onChange('descriptionAr', e.target.value)}
          />
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        disabled={disabled}
        className="text-sm font-medium text-ink-soft underline-offset-2 hover:underline"
      >
        {t('moreLanguages')}
      </button>
      {expanded ? (
        <div>
          <p className="mb-2 text-xs text-ink-soft">{t('moreLanguagesHint')}</p>
          <div className="grid grid-cols-2 gap-3">
            {EXTRA_LANGS.map((lang) => (
              <Field
                key={lang}
                maxLength={maxLength}
                disabled={disabled}
                label={`${t('nameEn').replace(/\(.*\)/, '')} (${lang.toUpperCase()})`}
                value={values[`name${lang}`] ?? ''}
                onChange={(e) => onChange(`name${lang}`, e.target.value)}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
