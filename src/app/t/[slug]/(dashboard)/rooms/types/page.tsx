'use client';

import { Pencil, Plus, ShieldAlert } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { ConfirmModal, ConsequenceNote, PageIntro } from '@/components/guidance';
import { RoomTypeModal } from '@/components/rooms/room-type-modal';
import { useTenant } from '@/components/tenant-provider';
import { Badge, Bdi, Button, EmptyState, ErrorState } from '@/components/ui';
import type { Locale } from '@/i18n/config';
import { api, ApiError } from '@/lib/api';
import { useApiError } from '@/lib/errors';
import type { RoomType } from '@/lib/types';

export default function RoomTypesPage() {
  const t = useTranslations('rooms.types');
  const tRooms = useTranslations('rooms');
  const tCommon = useTranslations('common');
  const tG = useTranslations('guidance.rooms.types');
  const resolveError = useApiError();
  const locale = useLocale() as Locale;
  const { hasPermission, readOnly } = useTenant();

  const canRead = hasPermission('rooms.read');
  const canUpdate = hasPermission('rooms.update');

  const [types, setTypes] = useState<RoomType[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState<RoomType | 'new' | null>(null);
  const [deactivating, setDeactivating] = useState<RoomType | null>(null);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);
  const [deactivateBusy, setDeactivateBusy] = useState(false);
  const [reactivatingId, setReactivatingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const localName = useCallback(
    (r: { nameEn: string; nameAr: string }) =>
      locale === 'ar' ? r.nameAr : r.nameEn,
    [locale],
  );
  const otherName = useCallback(
    (r: { nameEn: string; nameAr: string }) =>
      locale === 'ar' ? r.nameEn : r.nameAr,
    [locale],
  );
  const localDesc = (r: { descriptionEn: string | null; descriptionAr: string | null }) =>
    (locale === 'ar' ? r.descriptionAr : r.descriptionEn) || '';

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ data: RoomType[] }>(
        '/tenant/room-types?includeInactive=1',
      );
      setTypes(res.data);
    } catch (err) {
      setError(err instanceof ApiError ? resolveError(err) : t('loadError'));
    } finally {
      setLoading(false);
    }
  }, [resolveError, t]);

  useEffect(() => {
    if (canRead) load();
  }, [load, canRead]);

  function openCreate() {
    setRowError(null);
    setEditing('new');
  }

  function openEdit(type: RoomType) {
    setRowError(null);
    setEditing(type);
  }

  async function handleReactivate(type: RoomType) {
    setReactivatingId(type.id);
    setRowError(null);
    try {
      await api<RoomType>(`/tenant/room-types/${type.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: true }),
      });
      await load();
    } catch (err) {
      setRowError(resolveError(err));
    } finally {
      setReactivatingId(null);
    }
  }

  async function handleDeactivate() {
    if (!deactivating) return;
    setDeactivateBusy(true);
    setDeactivateError(null);
    try {
      await api<RoomType>(`/tenant/room-types/${deactivating.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: false }),
      });
      setDeactivating(null);
      await load();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'ROOM_TYPE_IN_USE') {
        const count =
          typeof (err.details as { roomsCount?: number })?.roomsCount ===
          'number'
            ? (err.details as { roomsCount: number }).roomsCount
            : deactivating.roomsCount;
        setDeactivateError(t('deactivate.inUse', { count }));
      } else {
        setDeactivateError(resolveError(err));
      }
    } finally {
      setDeactivateBusy(false);
    }
  }

  if (!canRead) {
    return (
      <EmptyState
        icon={<ShieldAlert size={28} />}
        title={t('noAccess.title')}
        hint={t('noAccess.hint')}
      />
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-gold">
            {t('eyebrow')}
          </p>
          <h1 className="mt-1 font-display text-2xl font-semibold text-ink">
            {t('title')}
          </h1>
          <PageIntro>{tG('intro')}</PageIntro>
        </div>
        {canUpdate && (
          <Button
            onClick={openCreate}
            disabled={readOnly}
            title={readOnly ? tRooms('readOnlyHint') : undefined}
          >
            <Plus size={16} aria-hidden /> {t('new')}
          </Button>
        )}
      </div>

      {rowError && (
        <div
          role="alert"
          className="mt-4 rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger"
        >
          {rowError}
        </div>
      )}

      <div className="mt-6">
        {loading ? (
          <p className="text-sm text-ink-soft">{tCommon('states.loading')}</p>
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : !types || types.length === 0 ? (
          <EmptyState
            title={t('empty.title')}
            hint={t('empty.hint')}
            action={
              canUpdate ? (
                <Button
                  onClick={openCreate}
                  disabled={readOnly}
                  title={readOnly ? tRooms('readOnlyHint') : undefined}
                >
                  {t('new')}
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {types.map((type) => (
              <div
                key={type.id}
                className="rounded-xl border border-line bg-white p-5"
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <p className="truncate font-display font-semibold text-ink">
                      <Bdi>{localName(type)}</Bdi>
                    </p>
                    <p className="truncate text-xs text-ink-soft">
                      <Bdi>{otherName(type)}</Bdi>
                    </p>
                  </div>
                  {canUpdate && (
                    <button
                      onClick={() => openEdit(type)}
                      aria-label={t('card.editAria', { name: localName(type) })}
                      disabled={readOnly}
                      title={readOnly ? tRooms('readOnlyHint') : undefined}
                      className="shrink-0 rounded p-1.5 text-ink-soft hover:text-ink disabled:opacity-40"
                    >
                      <Pencil size={15} />
                    </button>
                  )}
                </div>

                {localDesc(type) && (
                  <p className="mt-3 text-sm text-ink-soft">
                    <Bdi>{localDesc(type)}</Bdi>
                  </p>
                )}

                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge tone={type.isActive ? 'gold' : 'neutral'}>
                      {type.isActive ? t('card.active') : t('card.inactive')}
                    </Badge>
                    <span className="text-xs text-ink-soft">
                      {t('card.roomsCount', { count: type.roomsCount })}
                    </span>
                  </div>
                  {canUpdate &&
                    (type.isActive ? (
                      <button
                        onClick={() => {
                          setDeactivateError(null);
                          setDeactivating(type);
                        }}
                        disabled={readOnly}
                        title={readOnly ? tRooms('readOnlyHint') : undefined}
                        aria-label={t('card.deactivateAria', {
                          name: localName(type),
                        })}
                        // Deactivation is reversible, so it keeps neutral
                        // styling — not destructive-red (12.5 AC3).
                        className="rounded px-2 py-1 text-xs text-ink-soft hover:text-ink disabled:opacity-40"
                      >
                        {t('deactivate.confirm')}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleReactivate(type)}
                        disabled={readOnly || reactivatingId === type.id}
                        title={readOnly ? tRooms('readOnlyHint') : undefined}
                        aria-label={t('card.activateAria', {
                          name: localName(type),
                        })}
                        className="rounded px-2 py-1 text-xs text-ink-soft hover:text-ink disabled:opacity-40"
                      >
                        {t('activate.confirm')}
                      </button>
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <RoomTypeModal editing={editing} onClose={() => setEditing(null)} onSaved={load} />

      {/* 12.5 AC1/AC3 — deactivation is reversible (reactivate stays available
          from this same list), so the dialog is not destructive-styled. */}
      <ConfirmModal
        open={deactivating !== null}
        onClose={() => setDeactivating(null)}
        title={t('deactivate.title')}
        confirmLabel={t('deactivate.confirm')}
        onConfirm={handleDeactivate}
        loading={deactivateBusy}
        error={deactivateError}
      >
        {deactivating && (
          <ConsequenceNote>
            {t.rich('deactivate.body', {
              name: localName(deactivating),
              strong: (chunks) => <strong className="text-ink">{chunks}</strong>,
            })}
          </ConsequenceNote>
        )}
      </ConfirmModal>
    </div>
  );
}
