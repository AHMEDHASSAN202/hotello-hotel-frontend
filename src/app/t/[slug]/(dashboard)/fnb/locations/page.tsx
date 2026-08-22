'use client';

import { MapPin, Pencil, Plus, QrCode, ShieldAlert } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { LocationModal } from '@/components/fnb/location-modal';
import { LocationQrModal } from '@/components/fnb/location-qr-modal';
import { HintCard, PageIntro } from '@/components/guidance';
import { useTenant } from '@/components/tenant-provider';
import {
  Badge,
  Button,
  Code,
  EmptyState,
  ErrorState,
  Skeleton,
} from '@/components/ui';
import { useFormatters } from '@/i18n/use-format';
import { api } from '@/lib/api';
import { useApiError } from '@/lib/errors';
import type { FnbLocation, FnbLocationsResponse } from '@/lib/types';

/**
 * 16.3 — delivery locations: zone + numbered-spot definitions, QR stickers,
 * and the in-product operational guidance (zone stickers for everything;
 * numbered series only for fixed furniture).
 */
export default function FnbLocationsPage() {
  const t = useTranslations('fnb.locations');
  const tFnb = useTranslations('fnb');
  const resolveError = useApiError();
  const { locale } = useFormatters();
  const params = useParams<{ slug: string }>();
  const { hasPermission, readOnly } = useTenant();
  const canManage = hasPermission('fnb_locations.manage');

  const [locations, setLocations] = useState<FnbLocation[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{
    open: boolean;
    location: FnbLocation | null;
  }>({ open: false, location: null });
  const [qrFor, setQrFor] = useState<FnbLocation | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await api<FnbLocationsResponse>('/tenant/fnb-locations');
      setLocations(res.locations);
    } catch (err) {
      setLoadError(resolveError(err));
    }
  }, [resolveError]);

  useEffect(() => {
    if (canManage) void load();
  }, [canManage, load]);

  const nameFor = (names: { ar?: string; en?: string }) =>
    (locale === 'ar' ? names.ar : names.en) ?? names.en ?? '';

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
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-gold">
            {tFnb('eyebrow')}
          </p>
          <h1 className="mt-1 font-display text-2xl font-semibold text-ink">
            {t('title')}
          </h1>
          <PageIntro>{t('intro')}</PageIntro>
        </div>
        <Button
          onClick={() => setEditing({ open: true, location: null })}
          disabled={readOnly}
        >
          <Plus size={14} aria-hidden /> {t('add')}
        </Button>
      </div>

      {/* 16.3 AC3 — the zone-vs-numbered recommendation, in product. */}
      <HintCard hintKey="fnb.locationsGuidance" title={t('guidance.title')}>
        {t('guidance.body')}
      </HintCard>

      {loadError ? (
        <div className="mt-6">
          <ErrorState message={loadError} onRetry={() => void load()} />
        </div>
      ) : locations === null ? (
        <div className="mt-6 space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : locations.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={<MapPin size={28} />}
            title={t('empty.title')}
            hint={t('empty.hint')}
            action={
              <Button
                onClick={() => setEditing({ open: true, location: null })}
                disabled={readOnly}
              >
                {t('add')}
              </Button>
            }
          />
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {locations.map((location) => (
            <li
              key={location.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-white p-4"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold-soft">
                <MapPin size={18} className="text-ink" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-ink">
                    {nameFor(location.names)}
                  </span>
                  <Code>{location.key}</Code>
                  {!location.isActive ? (
                    <Badge tone="neutral">{t('row.inactive')}</Badge>
                  ) : null}
                </span>
                <span className="mt-0.5 block text-sm text-ink-soft">
                  {location.hasSpots
                    ? t('row.spots', {
                        label: nameFor(location.spotLabel ?? {}),
                      })
                    : t('row.noSpots')}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <button
                  onClick={() => setQrFor(location)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm text-ink hover:border-ink"
                >
                  <QrCode size={14} aria-hidden /> {t('row.qr')}
                </button>
                <button
                  onClick={() => setEditing({ open: true, location })}
                  disabled={readOnly}
                  aria-label={`${t('row.edit')}: ${nameFor(location.names)}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm text-ink hover:border-ink disabled:opacity-50"
                >
                  <Pencil size={14} aria-hidden /> {t('row.edit')}
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <LocationModal
        open={editing.open}
        location={editing.location}
        onClose={() => setEditing({ open: false, location: null })}
        onSaved={() => void load()}
      />
      <LocationQrModal
        location={qrFor}
        slug={params.slug}
        onClose={() => setQrFor(null)}
      />
    </div>
  );
}
