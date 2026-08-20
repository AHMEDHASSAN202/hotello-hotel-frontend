'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { useTenant } from '@/components/tenant-provider';
import { Button, ErrorState, Field, Skeleton } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useApiError } from '@/lib/errors';
import type { StaySettings } from '@/lib/types';

/**
 * 13.4 AC2 — the hotel's checkout hour. Rendered only for `stays.update`
 * holders (the page gates it); mutations still disable under readOnly.
 */
export function StaySettingsCard() {
  const t = useTranslations('stays.settings');
  const tG = useTranslations('guidance.stays');
  const tList = useTranslations('stays.list');
  const resolveError = useApiError();
  const { readOnly } = useTenant();

  const [checkoutTime, setCheckoutTime] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await api<StaySettings>('/tenant/stays/settings');
      setCheckoutTime(res.checkoutTime);
    } catch (err) {
      setLoadError(
        err instanceof ApiError ? resolveError(err) : t('loadError'),
      );
    } finally {
      setLoading(false);
    }
  }, [resolveError, t]);

  useEffect(() => {
    load();
  }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const res = await api<StaySettings>('/tenant/stays/settings', {
        method: 'PATCH',
        body: JSON.stringify({ checkoutTime }),
      });
      setCheckoutTime(res.checkoutTime);
      setSaved(true);
    } catch (err) {
      setSaveError(
        err instanceof ApiError ? resolveError(err) : t('loadError'),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="max-w-md rounded-xl border border-line bg-white p-6">
      <h2 className="font-display text-lg font-semibold text-ink">
        {t('title')}
      </h2>
      <p className="mt-1 text-sm text-ink-soft">{tG('settingsIntro')}</p>

      {loading ? (
        <Skeleton className="mt-4 h-10 w-full" />
      ) : loadError ? (
        <div className="mt-4">
          <ErrorState message={loadError} onRetry={load} />
        </div>
      ) : (
        <form className="mt-4 space-y-4" onSubmit={save}>
          <Field
            label={t('checkoutTime.label')}
            hint={t('checkoutTime.hint')}
            type="time"
            required
            value={checkoutTime}
            onChange={(e) => {
              setSaved(false);
              setCheckoutTime(e.target.value);
            }}
          />
          {saveError && (
            <p role="alert" className="text-sm text-danger">
              {saveError}
            </p>
          )}
          {saved && (
            <p role="status" className="text-sm text-success">
              {t('saved')}
            </p>
          )}
          <Button
            type="submit"
            loading={saving}
            disabled={readOnly}
            title={readOnly ? tList('readOnlyHint') : undefined}
          >
            {saving ? t('saving') : t('save')}
          </Button>
        </form>
      )}
    </section>
  );
}
