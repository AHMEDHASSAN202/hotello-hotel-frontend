'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { useTenant } from '@/components/tenant-provider';
import { Button, ErrorState, Field, Skeleton } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useApiError } from '@/lib/errors';
import type { HousekeepingSettings } from '@/lib/types';

/**
 * 20.1 AC4 — the hotel's daily service hour: each morning at this time,
 * occupied rooms flag themselves for daily service (and DND lifts). Same
 * six-state card as StaySettingsCard; PATCH gated by `housekeeping.update`
 * (the page gates it), mutations still disable under readOnly.
 */
export function HousekeepingSettingsCard() {
  const t = useTranslations('housekeeping.settings');
  const tG = useTranslations('guidance.housekeeping');
  const tList = useTranslations('stays.list');
  const resolveError = useApiError();
  const { readOnly } = useTenant();

  const [dailyServiceTime, setDailyServiceTime] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await api<HousekeepingSettings>(
        '/tenant/housekeeping/settings',
      );
      setDailyServiceTime(res.dailyServiceTime);
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
      const res = await api<HousekeepingSettings>(
        '/tenant/housekeeping/settings',
        {
          method: 'PATCH',
          body: JSON.stringify({ dailyServiceTime }),
        },
      );
      setDailyServiceTime(res.dailyServiceTime);
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
        {t('cardTitle')}
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
            label={t('dailyServiceTime.label')}
            hint={t('dailyServiceTime.hint')}
            type="time"
            required
            value={dailyServiceTime}
            onChange={(e) => {
              setSaved(false);
              setDailyServiceTime(e.target.value);
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
