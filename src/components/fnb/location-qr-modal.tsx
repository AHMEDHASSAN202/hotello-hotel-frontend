'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { CopyButton } from '@/components/copy-button';
import { Button, Code, ErrorState, Field, Modal, Skeleton } from '@/components/ui';
import { apiBlob, guestUrlForSlug, saveBlob } from '@/lib/api';
import { useApiError } from '@/lib/errors';
import type { FnbLocation } from '@/lib/types';

/**
 * 16.3 AC2 — the location's QR (view/copy/download) + sticker PDFs: a single
 * zone sticker or a numbered series via the Epic 11 range machinery.
 * Downloads are GETs and stay available under readOnly (Epic 11 ruling).
 * Stale-response guard mirrors room-qr-modal.
 */
export function LocationQrModal({
  location,
  slug,
  onClose,
}: {
  location: FnbLocation | null;
  slug: string;
  onClose: () => void;
}) {
  const t = useTranslations('fnb.locations.qrModal');
  const resolveError = useApiError();

  const [pngUrl, setPngUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mode, setMode] = useState<'single' | 'series'>('single');
  const [from, setFrom] = useState('1');
  const [to, setTo] = useState('20');
  const [exclusions, setExclusions] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const latestId = useRef<string | null>(null);

  useEffect(() => {
    latestId.current = location?.id ?? null;
    setPngUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setLoadError(null);
    setMode('single');
    setGenerateError(null);
    if (!location) return;
    apiBlob(`/tenant/fnb-locations/${location.id}/qr?format=png`)
      .then(({ blob }) => {
        if (latestId.current !== location.id) return;
        setPngUrl(URL.createObjectURL(blob));
      })
      .catch((err) => {
        if (latestId.current !== location.id) return;
        setLoadError(resolveError(err));
      });
    return () => {
      setPngUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, [location, resolveError]);

  if (!location) return null;

  const guestUrl = `${guestUrlForSlug(slug)}?location=${location.key}`;
  const seriesValid =
    mode === 'single' ||
    (Number(from) >= 1 && Number(to) >= Number(from) && Number(to) <= 9999);

  async function downloadStickers() {
    if (!location) return;
    setGenerating(true);
    setGenerateError(null);
    try {
      const query = new URLSearchParams();
      if (mode === 'series') {
        query.set('from', from);
        query.set('to', to);
        if (exclusions.trim()) query.set('exclusions', exclusions.trim());
      }
      const { blob, filename } = await apiBlob(
        `/tenant/fnb-locations/${location.id}/pdf/stickers${
          query.size ? `?${query}` : ''
        }`,
      );
      saveBlob(blob, filename ?? 'location-stickers.pdf');
    } catch (err) {
      setGenerateError(resolveError(err));
    } finally {
      setGenerating(false);
    }
  }

  const name = location.names.en ?? '';

  return (
    <Modal open onClose={onClose} title={t('title', { name })} wide>
      <div className="flex flex-wrap items-start gap-6">
        <div className="shrink-0">
          {loadError ? (
            <ErrorState message={loadError} />
          ) : pngUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={pngUrl}
              alt="QR"
              className="h-40 w-40 rounded-lg border border-line"
            />
          ) : (
            <Skeleton className="h-40 w-40" />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-ink-soft">
              {t('urlLabel')}
            </p>
            <div className="mt-1 flex items-center gap-2">
              <Code className="truncate">{guestUrl}</Code>
              <CopyButton value={guestUrl} />
            </div>
          </div>

          {/* Sticker mode (16.3 AC2/AC3) */}
          <div className="flex gap-2 rounded-lg border border-line p-1">
            {(['single', ...(location.hasSpots ? ['series'] : [])] as const).map(
              (key) => (
                <button
                  key={key}
                  aria-pressed={mode === key}
                  onClick={() => setMode(key as 'single' | 'series')}
                  className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    mode === key
                      ? 'bg-ink text-white'
                      : 'text-ink-soft hover:text-ink'
                  }`}
                >
                  {t(key)}
                </button>
              ),
            )}
          </div>

          {mode === 'series' ? (
            <div className="flex flex-wrap items-end gap-3">
              <Field
                label={t('from')}
                type="number"
                min={1}
                max={9999}
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
              <Field
                label={t('to')}
                type="number"
                min={1}
                max={9999}
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
              <Field
                label={t('exclusions')}
                hint={t('exclusionsHint')}
                value={exclusions}
                onChange={(e) => setExclusions(e.target.value)}
              />
            </div>
          ) : null}

          {!seriesValid ? (
            <p className="text-sm text-danger">{t('rangeInvalid')}</p>
          ) : null}
          {generateError ? (
            <p role="alert" className="text-sm text-danger">
              {generateError}
            </p>
          ) : null}
          <Button
            onClick={() => void downloadStickers()}
            loading={generating}
            disabled={!seriesValid}
          >
            {generating ? t('generating') : t('generate')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
