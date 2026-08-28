'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Field } from '@/components/ui';
import type { TenantAnnouncement } from '@/lib/types';

/**
 * 19.1 AC1 — the 7-language title + body editor. Same shape as NameFields
 * (flat DTO-keyed record, AR+EN required, five languages behind a
 * collapsible) but with textareas for the body and full extra-language
 * coverage for both fields. All 14 keys always ride the payload so edits can
 * blank an optional locale (the backend removes blanked locales).
 */
export const CONTENT_LANGS = ['En', 'Ar', 'Ru', 'Fr', 'It', 'Es', 'De'] as const;
const EXTRA_LANGS = ['Ru', 'Fr', 'It', 'Es', 'De'] as const;

export const TITLE_MAX = 120;
export const BODY_MAX = 2000;

export type AnnouncementContentValues = Record<string, string>;

export function contentToFields(
  a?: Pick<TenantAnnouncement, 'titles' | 'bodies'> | null,
): AnnouncementContentValues {
  const out: AnnouncementContentValues = {};
  for (const lang of CONTENT_LANGS) {
    const key = lang.toLowerCase() as keyof TenantAnnouncement['titles'];
    out[`title${lang}`] = a?.titles?.[key] ?? '';
    out[`body${lang}`] = a?.bodies?.[key] ?? '';
  }
  return out;
}

export function contentToPayload(
  values: AnnouncementContentValues,
): Record<string, string> {
  const payload: Record<string, string> = {};
  for (const lang of CONTENT_LANGS) {
    payload[`title${lang}`] = values[`title${lang}`]?.trim() ?? '';
    payload[`body${lang}`] = values[`body${lang}`]?.trim() ?? '';
  }
  return payload;
}

export function contentComplete(values: AnnouncementContentValues): boolean {
  return Boolean(
    values.titleEn?.trim() &&
      values.titleAr?.trim() &&
      values.bodyEn?.trim() &&
      values.bodyAr?.trim(),
  );
}

function BodyArea({
  label,
  value,
  onChange,
  disabled,
  required = false,
  dir,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  required?: boolean;
  dir?: 'rtl' | 'ltr';
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-ink">
        {label}
        {required ? (
          <span aria-hidden className="text-danger">
            {' '}
            *
          </span>
        ) : null}
      </span>
      <textarea
        rows={4}
        maxLength={BODY_MAX}
        disabled={disabled}
        dir={dir}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-soft/50 disabled:bg-paper disabled:text-ink-soft"
      />
    </label>
  );
}

export function AnnouncementContentFields({
  values,
  onChange,
  disabled = false,
}: {
  values: AnnouncementContentValues;
  onChange: (key: string, value: string) => void;
  disabled?: boolean;
}) {
  const t = useTranslations('announcements.fields');
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field
          label={t('titleEn')}
          hint={t('help')}
          required
          maxLength={TITLE_MAX}
          disabled={disabled}
          value={values.titleEn ?? ''}
          onChange={(e) => onChange('titleEn', e.target.value)}
        />
        <Field
          label={t('titleAr')}
          required
          dir="rtl"
          maxLength={TITLE_MAX}
          disabled={disabled}
          value={values.titleAr ?? ''}
          onChange={(e) => onChange('titleAr', e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <BodyArea
          label={t('bodyEn')}
          required
          disabled={disabled}
          value={values.bodyEn ?? ''}
          onChange={(v) => onChange('bodyEn', v)}
        />
        <BodyArea
          label={t('bodyAr')}
          required
          dir="rtl"
          disabled={disabled}
          value={values.bodyAr ?? ''}
          onChange={(v) => onChange('bodyAr', v)}
        />
      </div>
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
        <div className="space-y-3">
          <p className="text-xs text-ink-soft">{t('moreLanguagesHint')}</p>
          {EXTRA_LANGS.map((lang) => (
            <div key={lang} className="grid grid-cols-2 gap-3">
              <Field
                label={`${t('titleEn').replace(/\(.*\)/, '')} (${lang.toUpperCase()})`}
                maxLength={TITLE_MAX}
                disabled={disabled}
                value={values[`title${lang}`] ?? ''}
                onChange={(e) => onChange(`title${lang}`, e.target.value)}
              />
              <BodyArea
                label={`${t('bodyEn').replace(/\(.*\)/, '')} (${lang.toUpperCase()})`}
                disabled={disabled}
                value={values[`body${lang}`] ?? ''}
                onChange={(v) => onChange(`body${lang}`, v)}
              />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
