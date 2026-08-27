'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { Hotel as HotelIcon, X } from 'lucide-react';
import { Button } from '@/components/ui';
import { api, apiUpload, assetUrl } from '@/lib/api';
import { useApiError } from '@/lib/errors';
import { useTenant } from '@/components/tenant-provider';
import { isValidPhoto, PHOTO_TYPES } from '@/components/photo-picker';
import { EXTRA_LANGS } from '@/components/name-fields';
import type { InfoEntryManage } from '@/lib/types';

export const ABOUT_MAX_PHOTOS = 8;

const LANGS = ['En', 'Ar', ...EXTRA_LANGS] as const;

/**
 * 17.1 AC1 — the About singleton: paragraphs-only text (7 locales, EN/AR
 * primary + disclosure extras) and a gallery of up to 8 photos. Photos need
 * the row to exist first (uploads address its id), hence the saveFirst hint.
 */
export function AboutCard({
  about,
  onSaved,
}: {
  about: InfoEntryManage | null;
  onSaved: () => void;
}) {
  const t = useTranslations('hotelInfo.about');
  const { readOnly } = useTenant();
  const resolveError = useApiError();
  const fileInput = useRef<HTMLInputElement | null>(null);

  const [texts, setTexts] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTexts(
      Object.fromEntries(
        LANGS.map((lang) => [
          lang,
          about?.descriptions?.[
            lang.toLowerCase() as keyof typeof about.descriptions
          ] ?? '',
        ]),
      ),
    );
    setError(null);
  }, [about]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api('/tenant/hotel-info/about', {
        method: 'PUT',
        body: JSON.stringify(
          Object.fromEntries(
            LANGS.map((lang) => [`description${lang}`, texts[lang]?.trim() ?? '']),
          ),
        ),
      });
      onSaved();
    } catch (err) {
      setError(resolveError(err));
    } finally {
      setBusy(false);
    }
  }

  async function addPhoto(file: File | undefined) {
    if (!about || !file) return;
    setError(null);
    if (!isValidPhoto(file)) {
      setError(t('photoInvalid'));
      return;
    }
    setPhotoBusy(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      await apiUpload(`/tenant/hotel-info/entries/${about.id}/photos`, formData);
      onSaved();
    } catch (err) {
      setError(resolveError(err));
    } finally {
      setPhotoBusy(false);
    }
  }

  async function removePhoto(photoId: string) {
    if (!about) return;
    setError(null);
    setPhotoBusy(true);
    try {
      await api(`/tenant/hotel-info/entries/${about.id}/photos/${photoId}`, {
        method: 'DELETE',
      });
      onSaved();
    } catch (err) {
      setError(resolveError(err));
    } finally {
      setPhotoBusy(false);
    }
  }

  const photos = about?.photos ?? [];
  const galleryFull = photos.length >= ABOUT_MAX_PHOTOS;

  return (
    <section className="rounded-xl border border-line bg-white p-5">
      <div className="mb-1 flex items-center gap-2">
        <HotelIcon size={18} className="text-gold" aria-hidden />
        <h2 className="font-display text-lg font-semibold text-ink">
          {t('title')}
        </h2>
      </div>
      <p className="mb-4 text-sm text-ink-soft">
        {t('intro', { max: ABOUT_MAX_PHOTOS })}
      </p>
      {about === null ? (
        <p className="mb-4 text-sm text-ink-soft">{t('empty')}</p>
      ) : null}
      <form onSubmit={save} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-ink">
              {t('textEn')}
            </span>
            <textarea
              rows={5}
              className="w-full rounded-lg border border-line px-3 py-2 text-sm"
              value={texts.En ?? ''}
              onChange={(e) => setTexts((s) => ({ ...s, En: e.target.value }))}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-ink">
              {t('textAr')}
            </span>
            <textarea
              rows={5}
              dir="rtl"
              className="w-full rounded-lg border border-line px-3 py-2 text-sm"
              value={texts.Ar ?? ''}
              onChange={(e) => setTexts((s) => ({ ...s, Ar: e.target.value }))}
            />
          </label>
        </div>
        <p className="text-xs text-ink-soft">{t('textHelp')}</p>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="text-sm font-medium text-ink-soft underline-offset-2 hover:underline"
        >
          {t('moreLanguages')}
        </button>
        {expanded ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {EXTRA_LANGS.map((lang) => (
              <label key={lang} className="block">
                <span className="mb-1 block text-sm font-medium text-ink">
                  {t('textLang', { lang: lang.toUpperCase() })}
                </span>
                <textarea
                  rows={4}
                  className="w-full rounded-lg border border-line px-3 py-2 text-sm"
                  value={texts[lang] ?? ''}
                  onChange={(e) =>
                    setTexts((s) => ({ ...s, [lang]: e.target.value }))
                  }
                />
              </label>
            ))}
          </div>
        ) : null}
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <div className="flex justify-end">
          <Button type="submit" loading={busy} disabled={readOnly}>
            {t('save')}
          </Button>
        </div>
      </form>

      <div className="mt-5 border-t border-line pt-4">
        <span className="mb-2 block text-sm font-medium text-ink">
          {t('gallery')}
        </span>
        {about === null ? (
          <p className="text-sm text-ink-soft">{t('saveFirst')}</p>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            {photos.map((photo) => (
              <div key={photo.id} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={assetUrl(photo.thumbUrl) ?? undefined}
                  alt=""
                  className="h-16 w-20 rounded-lg border border-line object-cover"
                />
                <button
                  type="button"
                  aria-label={t('removePhoto')}
                  disabled={readOnly || photoBusy}
                  onClick={() => void removePhoto(photo.id)}
                  className="absolute -end-1.5 -top-1.5 rounded-full border border-line bg-white p-0.5 text-ink-soft shadow-sm hover:text-danger"
                >
                  <X size={12} aria-hidden />
                </button>
              </div>
            ))}
            <input
              ref={fileInput}
              type="file"
              accept={PHOTO_TYPES.join(',')}
              className="hidden"
              onChange={(e) => {
                void addPhoto(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
            {galleryFull ? (
              <p className="text-xs text-ink-soft">
                {t('galleryFull', { max: ABOUT_MAX_PHOTOS })}
              </p>
            ) : (
              <Button
                type="button"
                variant="ghost"
                loading={photoBusy}
                disabled={readOnly}
                onClick={() => fileInput.current?.click()}
              >
                {t('addPhoto')}
              </Button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
