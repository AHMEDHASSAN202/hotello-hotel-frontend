'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { useTenant } from '@/components/tenant-provider';
import { Button, ErrorState, Field, Skeleton } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useApiError } from '@/lib/errors';
import { selectClass } from '@/components/ui';
import type { StaySettings, StayType } from '@/lib/types';
import { STAY_TYPES } from '@/lib/types';

/**
 * 13.4 AC2 — the hotel's checkout hour. Rendered only for `stays.update`
 * holders (the page gates it); mutations still disable under readOnly.
 */
export function StaySettingsCard() {
  const t = useTranslations('stays.settings');
  const tG = useTranslations('guidance.stays');
  const tList = useTranslations('stays.list');
  const tStayTypes = useTranslations('stays.stayTypes');
  const resolveError = useApiError();
  const { readOnly } = useTenant();

  const [checkoutTime, setCheckoutTime] = useState('');
  const [defaultStayType, setDefaultStayType] = useState<StayType>('room_only');
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
      setDefaultStayType(res.defaultStayType);
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
        body: JSON.stringify({ checkoutTime, defaultStayType }),
      });
      setCheckoutTime(res.checkoutTime);
      setDefaultStayType(res.defaultStayType);
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
          {/* 16.1 AC2 — resorts set All-Inclusive; city hotels keep Room only. */}
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-ink">
              {t('defaultStayType.label')}
            </span>
            <select
              className={`${selectClass} w-full`}
              value={defaultStayType}
              onChange={(e) => {
                setSaved(false);
                setDefaultStayType(e.target.value as StayType);
              }}
            >
              {STAY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {tStayTypes(type)}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-ink-soft">
              {t('defaultStayType.hint')}
            </span>
          </label>
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
