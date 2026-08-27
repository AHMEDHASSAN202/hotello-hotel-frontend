'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Wifi } from 'lucide-react';
import { InfoTip } from '@/components/guidance';
import { Button, Field } from '@/components/ui';
import { api } from '@/lib/api';
import { useApiError } from '@/lib/errors';
import { useTenant } from '@/components/tenant-provider';
import type { InfoEntryManage } from '@/lib/types';

const FIELDS = [
  'wifiName',
  'wifiPassword',
  'receptionPhone',
  'whatsapp',
  'emergencyPhone',
] as const;

/**
 * 17.1 AC1 — the Essentials singleton: WiFi + key numbers, saved as one PUT
 * (clearing every field removes the card for guests). Checkout time is a
 * read-only projection of the Epic 13 setting.
 */
export function EssentialsCard({
  essentials,
  checkoutTime,
  onSaved,
}: {
  essentials: InfoEntryManage | null;
  checkoutTime: string;
  onSaved: () => void;
}) {
  const t = useTranslations('hotelInfo.essentials');
  const { readOnly } = useTenant();
  const resolveError = useApiError();

  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const structured = essentials?.structured ?? {};
    setValues(
      Object.fromEntries(FIELDS.map((f) => [f, structured[f] ?? ''])),
    );
    setError(null);
  }, [essentials]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api('/tenant/hotel-info/essentials', {
        method: 'PUT',
        body: JSON.stringify(
          Object.fromEntries(FIELDS.map((f) => [f, values[f]?.trim() ?? ''])),
        ),
      });
      onSaved();
    } catch (err) {
      setError(resolveError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-line bg-white p-5">
      <div className="mb-1 flex items-center gap-2">
        <Wifi size={18} className="text-gold" aria-hidden />
        <h2 className="font-display text-lg font-semibold text-ink">
          {t('title')}
        </h2>
      </div>
      <p className="mb-4 text-sm text-ink-soft">{t('intro')}</p>
      {essentials === null ? (
        <p className="mb-4 text-sm text-ink-soft">{t('empty')}</p>
      ) : null}
      <form onSubmit={save} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label={t('wifiName')}
            value={values.wifiName ?? ''}
            onChange={(e) => setValues((v) => ({ ...v, wifiName: e.target.value }))}
          />
          <Field
            label={t('wifiPassword')}
            hint={t('wifiPasswordHelp')}
            value={values.wifiPassword ?? ''}
            onChange={(e) =>
              setValues((v) => ({ ...v, wifiPassword: e.target.value }))
            }
          />
          <Field
            label={t('receptionPhone')}
            hint={t('phoneHelp')}
            placeholder="+20 100 123 4567"
            dir="ltr"
            value={values.receptionPhone ?? ''}
            onChange={(e) =>
              setValues((v) => ({ ...v, receptionPhone: e.target.value }))
            }
          />
          <Field
            label={t('whatsapp')}
            placeholder="+20 100 123 4567"
            dir="ltr"
            value={values.whatsapp ?? ''}
            onChange={(e) => setValues((v) => ({ ...v, whatsapp: e.target.value }))}
          />
          <Field
            label={t('emergencyPhone')}
            placeholder="+20 100 123 4567"
            dir="ltr"
            value={values.emergencyPhone ?? ''}
            onChange={(e) =>
              setValues((v) => ({ ...v, emergencyPhone: e.target.value }))
            }
          />
          <div>
            <span className="mb-1 flex items-center gap-1 text-sm font-medium text-ink">
              {t('checkout')}
              <InfoTip>{t('checkoutHelp')}</InfoTip>
            </span>
            <p className="rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink-soft">
              {checkoutTime}
            </p>
          </div>
        </div>
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
    </section>
  );
}
