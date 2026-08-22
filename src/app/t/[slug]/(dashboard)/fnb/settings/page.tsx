'use client';

import { ShieldAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { PageIntro } from '@/components/guidance';
import { useTenant } from '@/components/tenant-provider';
import { Button, EmptyState, ErrorState, Skeleton } from '@/components/ui';
import { api } from '@/lib/api';
import { useApiError } from '@/lib/errors';
import type { FnbSettings } from '@/lib/types';

/**
 * 16.4 — payment methods: cash is always on (never a toggle); room charge
 * (pay at checkout) is the single opt-in. Online payment is a future epic.
 */
export default function FnbSettingsPage() {
  const t = useTranslations('fnb.settings');
  const tFnb = useTranslations('fnb');
  const tList = useTranslations('stays.list');
  const resolveError = useApiError();
  const { hasPermission, readOnly } = useTenant();
  const canManage = hasPermission('fnb_settings.manage');

  const [roomChargeEnabled, setRoomChargeEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await api<FnbSettings>('/tenant/fnb/settings');
      setRoomChargeEnabled(res.roomChargeEnabled);
    } catch (err) {
      setLoadError(resolveError(err));
    } finally {
      setLoading(false);
    }
  }, [resolveError]);

  useEffect(() => {
    if (canManage) void load();
  }, [canManage, load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const res = await api<FnbSettings>('/tenant/fnb/settings', {
        method: 'PATCH',
        body: JSON.stringify({ roomChargeEnabled }),
      });
      setRoomChargeEnabled(res.roomChargeEnabled);
      setSaved(true);
    } catch (err) {
      setSaveError(resolveError(err));
    } finally {
      setSaving(false);
    }
  }

  if (!canManage) {
    return (
      <EmptyState
        icon={<ShieldAlert size={28} />}
        title={tFnb('board.noAccess.title')}
        hint={tFnb('board.noAccess.hint')}
      />
    );
  }

  return (
    <div>
      <p className="text-xs uppercase tracking-widest text-gold">
        {tFnb('eyebrow')}
      </p>
      <h1 className="mt-1 font-display text-2xl font-semibold text-ink">
        {t('title')}
      </h1>
      <PageIntro>{t('intro')}</PageIntro>

      <section className="mt-6 max-w-md rounded-xl border border-line bg-white p-6">
        {loading ? (
          <Skeleton className="h-24 w-full" />
        ) : loadError ? (
          <ErrorState message={loadError} onRetry={() => void load()} />
        ) : (
          <form className="space-y-4" onSubmit={save}>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" checked disabled className="mt-0.5" />
              <span>
                <span className="font-medium text-ink">{t('cashLabel')}</span>
                <span className="block text-xs text-ink-soft">
                  {t('cashHint')}
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={roomChargeEnabled}
                onChange={(e) => {
                  setSaved(false);
                  setRoomChargeEnabled(e.target.checked);
                }}
              />
              <span>
                <span className="font-medium text-ink">
                  {t('roomChargeLabel')}
                </span>
                <span className="block text-xs text-ink-soft">
                  {t('roomChargeHint')}
                </span>
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
    </div>
  );
}
