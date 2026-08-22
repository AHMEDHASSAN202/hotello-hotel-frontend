'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { RequiredNote } from '@/components/guidance';
import { Button, Code, Field, Modal } from '@/components/ui';
import { api } from '@/lib/api';
import { useApiError } from '@/lib/errors';
import type { FnbLocation } from '@/lib/types';

/**
 * 16.3 AC1/AC4 — location editor. The QR key is server-generated at create
 * and IMMUTABLE afterwards (printed stickers embed it) — edit shows it as a
 * locked code; renaming changes display names only.
 */
export function LocationModal({
  location,
  open,
  onClose,
  onSaved,
}: {
  location: FnbLocation | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations('fnb.locations.modal');
  const tCommon = useTranslations('common');
  const resolveError = useApiError();

  const [nameEn, setNameEn] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [hasSpots, setHasSpots] = useState(false);
  const [spotLabelEn, setSpotLabelEn] = useState('');
  const [spotLabelAr, setSpotLabelAr] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setNameEn(location?.names.en ?? '');
    setNameAr(location?.names.ar ?? '');
    setHasSpots(location?.hasSpots ?? false);
    setSpotLabelEn(location?.spotLabel?.en ?? '');
    setSpotLabelAr(location?.spotLabel?.ar ?? '');
    setIsActive(location?.isActive ?? true);
    setError(null);
  }, [open, location]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = {
        nameEn: nameEn.trim(),
        nameAr: nameAr.trim(),
        hasSpots,
        ...(hasSpots
          ? { spotLabelEn: spotLabelEn.trim(), spotLabelAr: spotLabelAr.trim() }
          : {}),
        isActive,
      };
      if (location) {
        await api(`/tenant/fnb-locations/${location.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
      } else {
        await api('/tenant/fnb-locations', {
          method: 'POST',
          body: JSON.stringify(body),
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

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={location ? t('editTitle') : t('createTitle')}
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field
            label={t('nameEn')}
            required
            value={nameEn}
            onChange={(e) => setNameEn(e.target.value)}
          />
          <Field
            label={t('nameAr')}
            required
            dir="rtl"
            value={nameAr}
            onChange={(e) => setNameAr(e.target.value)}
          />
        </div>

        {location ? (
          <div>
            <span className="mb-1 block text-sm font-medium text-ink">
              {t('keyLabel')}
            </span>
            <Code>{location.key}</Code>
            <p className="mt-1 text-xs text-ink-soft">{t('keyHint')}</p>
          </div>
        ) : (
          <p className="text-xs text-ink-soft">{t('keyHint')}</p>
        )}

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={hasSpots}
            onChange={(e) => setHasSpots(e.target.checked)}
          />
          {t('hasSpots')}
        </label>
        {hasSpots ? (
          <div className="grid grid-cols-2 gap-3">
            <Field
              label={t('spotLabelEn')}
              hint={t('spotLabelHint')}
              value={spotLabelEn}
              onChange={(e) => setSpotLabelEn(e.target.value)}
            />
            <Field
              label={t('spotLabelAr')}
              dir="rtl"
              value={spotLabelAr}
              onChange={(e) => setSpotLabelAr(e.target.value)}
            />
          </div>
        ) : null}

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          <span>
            {t('activeLabel')}
            <span className="ms-2 text-xs text-ink-soft">{t('activeHint')}</span>
          </span>
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
            disabled={!nameEn.trim() || !nameAr.trim()}
          >
            {location ? t('save') : t('create')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
