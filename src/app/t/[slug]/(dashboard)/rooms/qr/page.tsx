'use client';

import { Printer, Search, ShieldAlert } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CopyButton } from '@/components/copy-button';
import { PageIntro } from '@/components/guidance';
import { useTenant } from '@/components/tenant-provider';
import {
  Button,
  Code,
  EmptyState,
  ErrorState,
  Field,
  Skeleton,
} from '@/components/ui';
import { api, apiBlob, ApiError, guestUrlForSlug, saveBlob } from '@/lib/api';
import { useApiError } from '@/lib/errors';
import type { Room, RoomsListResponse } from '@/lib/types';

type PosterSize = 'a4' | 'a5';
type CardsScope = 'all' | 'floors' | 'rooms';

/** Mirrors the backend's `MAX_CARDS_ROOM_IDS` (`cards-pdf.dto.ts`) — kept in
 * sync manually since the two repos don't share constants. */
const MAX_CARDS_ROOM_IDS = 100;

/** Rooms are loaded once for the whole page (zero-rooms check + the
 * "specific rooms" checklist); 200 is the list endpoint's own page-size cap. */
const ROOMS_LOAD_PAGE_SIZE = 200;

const toggleClass = (active: boolean) =>
  `rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
    active
      ? 'border-ink bg-ink text-white'
      : 'border-line bg-white text-ink-soft hover:text-ink'
  }`;

/** Comma-separated integers ("1, 2, 3" → [1, 2, 3]) — mirrors the bulk-add
 * exclusions parser (add-rooms-modal.tsx): blanks/non-numeric are dropped
 * silently rather than rejected. */
function parseFloors(raw: string): number[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number)
    .filter((n) => Number.isInteger(n));
}

/**
 * Story 11.5 — the physical-materials hub: a hotel-wide poster QR (for
 * common areas) and per-room QR cards (scoped to all rooms, specific floors,
 * or a hand-picked selection). Every download here is a GET and stays
 * enabled under a read-only (expired-trial) subscription — printing is part
 * of setup, not a mutation (controller-level ruling, Epic 11 notes).
 */
export default function RoomsQrPage() {
  const t = useTranslations('rooms.qr');
  const tG = useTranslations('guidance.rooms');
  const resolveError = useApiError();
  const params = useParams<{ slug: string }>();
  const { hasPermission, reload } = useTenant();

  const canRead = hasPermission('rooms.read');

  const [rooms, setRooms] = useState<Room[] | null>(null);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [roomsError, setRoomsError] = useState<string | null>(null);

  const loadRooms = useCallback(async () => {
    setRoomsLoading(true);
    setRoomsError(null);
    try {
      const res = await api<RoomsListResponse>(
        `/tenant/rooms?pageSize=${ROOMS_LOAD_PAGE_SIZE}`,
      );
      setRooms(res.data);
    } catch (err) {
      setRoomsError(
        err instanceof ApiError ? resolveError(err) : t('roomsLoadError'),
      );
    } finally {
      setRoomsLoading(false);
    }
  }, [resolveError, t]);

  useEffect(() => {
    if (canRead) loadRooms();
  }, [loadRooms, canRead]);

  if (!canRead) {
    return (
      <EmptyState
        icon={<ShieldAlert size={28} />}
        title={t('noAccess.title')}
        hint={t('noAccess.hint')}
      />
    );
  }

  const hasNoRooms =
    !roomsLoading && !roomsError && (rooms === null || rooms.length === 0);

  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-widest text-gold">
        {t('eyebrow')}
      </p>
      <h1 className="mt-1 font-display text-2xl font-semibold text-ink">
        {t('title')}
      </h1>
      <PageIntro>{tG('qrPrintIntro')}</PageIntro>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <PosterCard slug={params.slug} onGenerated={reload} />
        <CardsCard
          rooms={rooms}
          roomsLoading={roomsLoading}
          roomsError={roomsError}
          onRetryRooms={loadRooms}
          disabled={hasNoRooms}
          onGenerated={reload}
        />
      </div>
    </div>
  );
}

/** Reception poster: the hotel-wide guest URL as a print-ready A4/A5 PDF,
 * with the same QR rendered inline (general endpoint) so staff can preview
 * before printing. */
function PosterCard({
  slug,
  onGenerated,
}: {
  slug: string;
  onGenerated: () => void;
}) {
  const t = useTranslations('rooms.qr');
  const tCommon = useTranslations('common');
  const resolveError = useApiError();

  const [size, setSize] = useState<PosterSize>('a4');
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(true);
  const [qrError, setQrError] = useState<string | null>(null);

  const loadQr = useCallback(async () => {
    setQrLoading(true);
    setQrError(null);
    try {
      const { blob } = await apiBlob('/tenant/rooms/qr/general?format=png');
      setQrUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(blob);
      });
    } catch (err) {
      setQrError(
        err instanceof ApiError ? resolveError(err) : t('poster.qrLoadError'),
      );
    } finally {
      setQrLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolveError, t]);

  useEffect(() => {
    loadQr();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Revoke the object URL on unmount only — this card never re-fetches for a
  // different room, so there's no mid-life swap to revoke.
  useEffect(() => {
    return () => setQrUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  async function handleDownload() {
    setDownloading(true);
    setDownloadError(null);
    try {
      const { blob, filename } = await apiBlob(
        `/tenant/rooms/pdf/poster?size=${size}`,
      );
      saveBlob(blob, filename ?? `qr-poster-${size}.pdf`);
      onGenerated();
    } catch (err) {
      setDownloadError(resolveError(err));
    } finally {
      setDownloading(false);
    }
  }

  const guestUrl = guestUrlForSlug(slug);

  return (
    <div className="rounded-xl border border-line bg-white p-5">
      <h2 className="font-display font-semibold text-ink">
        {t('poster.title')}
      </h2>
      <p className="mt-1 text-sm text-ink-soft">{t('poster.hint')}</p>

      <div className="mt-4 flex justify-center">
        {qrLoading ? (
          <Skeleton className="h-40 w-40" />
        ) : qrError ? (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <p className="text-xs text-danger">{qrError}</p>
            <Button variant="ghost" onClick={loadQr}>
              {tCommon('actions.retry')}
            </Button>
          </div>
        ) : (
          qrUrl && (
            <img
              src={qrUrl}
              alt={t('poster.title')}
              className="h-40 w-40 rounded-lg border border-line p-2"
            />
          )
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 rounded-lg border border-line bg-paper px-3 py-2">
        <Code className="min-w-0 truncate text-xs text-ink">{guestUrl}</Code>
        <CopyButton value={guestUrl} />
      </div>

      <div className="mt-4">
        <span className="mb-1 block text-sm font-medium text-ink">
          {t('poster.sizeLabel')}
        </span>
        <div className="flex gap-2">
          {(['a4', 'a5'] as PosterSize[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSize(s)}
              className={toggleClass(size === s)}
            >
              {s.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {downloadError && (
        <div
          role="alert"
          className="mt-3 rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger"
        >
          {downloadError}
        </div>
      )}

      <div className="mt-4">
        <Button onClick={handleDownload} loading={downloading}>
          <Printer size={16} aria-hidden />{' '}
          {downloading ? t('poster.generating') : t('poster.download')}
        </Button>
      </div>
    </div>
  );
}

const SCOPE_LABEL_KEY: Record<CardsScope, string> = {
  all: 'cards.scopeAll',
  floors: 'cards.scopeFloors',
  rooms: 'cards.scopeRooms',
};

/** Room QR cards: one card per room, scoped to all rooms / specific floors /
 * a hand-picked selection (capped at 100 — mirrors the backend's own cap). */
function CardsCard({
  rooms,
  roomsLoading,
  roomsError,
  onRetryRooms,
  disabled,
  onGenerated,
}: {
  rooms: Room[] | null;
  roomsLoading: boolean;
  roomsError: string | null;
  onRetryRooms: () => void;
  disabled: boolean;
  onGenerated: () => void;
}) {
  const t = useTranslations('rooms.qr');
  const resolveError = useApiError();

  const [scope, setScope] = useState<CardsScope>('all');
  const [floorsInput, setFloorsInput] = useState('');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // Only active/out_of_service rooms are ever included server-side (11.5 —
  // inactive rooms don't get cards); offering inactive rooms here would let
  // staff "select" rooms the PDF silently drops.
  const selectableRooms = useMemo(
    () => (rooms ?? []).filter((r) => r.status !== 'inactive'),
    [rooms],
  );

  const filteredRooms = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return selectableRooms;
    return selectableRooms.filter((r) =>
      r.roomNumber.toLowerCase().includes(q),
    );
  }, [selectableRooms, search]);

  function toggleRoom(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < MAX_CARDS_ROOM_IDS) {
        next.add(id);
      }
      return next;
    });
  }

  const floors = useMemo(() => parseFloors(floorsInput), [floorsInput]);
  const canDownload =
    !disabled &&
    (scope === 'all' ||
      (scope === 'floors' && floors.length > 0) ||
      (scope === 'rooms' && selectedIds.size > 0));

  async function handleDownload() {
    setDownloading(true);
    setDownloadError(null);
    try {
      const qs = new URLSearchParams({ scope });
      if (scope === 'floors') qs.set('floors', floors.join(','));
      if (scope === 'rooms') {
        qs.set('roomIds', Array.from(selectedIds).join(','));
      }
      const { blob, filename } = await apiBlob(
        `/tenant/rooms/pdf/cards?${qs.toString()}`,
      );
      saveBlob(blob, filename ?? 'room-qr-cards.pdf');
      onGenerated();
    } catch (err) {
      setDownloadError(resolveError(err));
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="rounded-xl border border-line bg-white p-5">
      <h2 className="font-display font-semibold text-ink">
        {t('cards.title')}
      </h2>
      <p className="mt-1 text-sm text-ink-soft">{t('cards.hint')}</p>

      {disabled ? (
        <p className="mt-4 text-sm text-ink-soft">{t('cards.noRooms')}</p>
      ) : (
        <>
          <div className="mt-4">
            <span className="mb-1 block text-sm font-medium text-ink">
              {t('cards.scope')}
            </span>
            <div className="flex flex-wrap gap-2">
              {(['all', 'floors', 'rooms'] as CardsScope[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setScope(s)}
                  className={toggleClass(scope === s)}
                >
                  {t(SCOPE_LABEL_KEY[s])}
                </button>
              ))}
            </div>
          </div>

          {scope === 'floors' && (
            <div className="mt-3">
              <Field
                label={t('cards.floorsLabel')}
                dir="ltr"
                placeholder={t('cards.floorsPlaceholder')}
                value={floorsInput}
                onChange={(e) => setFloorsInput(e.target.value)}
              />
            </div>
          )}

          {scope === 'rooms' && (
            <div className="mt-3">
              <span className="mb-1 block text-sm font-medium text-ink">
                {t('cards.roomsLabel')}
              </span>
              {roomsLoading ? (
                <Skeleton className="h-40 w-full" />
              ) : roomsError ? (
                <ErrorState message={roomsError} onRetry={onRetryRooms} />
              ) : (
                <>
                  <div className="relative">
                    <Search
                      size={15}
                      className="absolute start-3 top-1/2 -translate-y-1/2 text-ink-soft/60"
                      aria-hidden
                    />
                    <input
                      type="search"
                      aria-label={t('cards.searchAria')}
                      placeholder={t('cards.roomsPlaceholder')}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full rounded-lg border border-line bg-white py-2 pe-3 ps-9 text-sm text-ink"
                    />
                  </div>
                  <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-line">
                    {filteredRooms.length === 0 ? (
                      <p className="p-3 text-center text-xs text-ink-soft">
                        {t('cards.searchEmpty')}
                      </p>
                    ) : (
                      filteredRooms.map((r) => {
                        const checked = selectedIds.has(r.id);
                        const capped =
                          !checked && selectedIds.size >= MAX_CARDS_ROOM_IDS;
                        return (
                          <label
                            key={r.id}
                            className={`flex items-center gap-2 border-b border-line px-3 py-2 text-sm last:border-b-0 ${
                              capped
                                ? 'opacity-40'
                                : 'cursor-pointer hover:bg-paper'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={capped}
                              onChange={() => toggleRoom(r.id)}
                            />
                            <Code>{r.roomNumber}</Code>
                            {r.floor !== null && (
                              <span className="text-xs text-ink-soft">
                                · {r.floor}
                              </span>
                            )}
                          </label>
                        );
                      })
                    )}
                  </div>
                  <p className="mt-1.5 text-xs text-ink-soft">
                    {t('cards.selectedCount', { count: selectedIds.size })} ·{' '}
                    {t('cards.capHint')}
                  </p>
                </>
              )}
            </div>
          )}

          {downloadError && (
            <div
              role="alert"
              className="mt-3 rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger"
            >
              {downloadError}
            </div>
          )}

          <div className="mt-4">
            <Button
              onClick={handleDownload}
              disabled={!canDownload}
              loading={downloading}
            >
              <Printer size={16} aria-hidden />{' '}
              {downloading ? t('cards.generating') : t('cards.download')}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
