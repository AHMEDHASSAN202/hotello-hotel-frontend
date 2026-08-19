'use client';

import { Pencil, Plus, QrCode, Search, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { HintCard, InfoTip, PageIntro } from '@/components/guidance';
import { AddRoomsModal } from '@/components/rooms/add-rooms-modal';
import { EditRoomModal } from '@/components/rooms/edit-room-modal';
import { RoomQrModal } from '@/components/rooms/room-qr-modal';
import { useTenant } from '@/components/tenant-provider';
import {
  Badge,
  Button,
  Code,
  EmptyState,
  ErrorState,
  Pagination,
  selectClass,
} from '@/components/ui';
import type { Locale } from '@/i18n/config';
import { api, ApiError } from '@/lib/api';
import { useApiError } from '@/lib/errors';
import type { Room, RoomsListResponse, RoomStatus, RoomType } from '@/lib/types';

const PAGE_SIZE = 50;

const STATUS_TONE: Record<RoomStatus, 'success' | 'warning' | 'neutral'> = {
  active: 'success',
  out_of_service: 'warning',
  inactive: 'neutral',
};

// Ghost-styled link — mirrors the Button `ghost` variant so the rooms-types
// and QR-and-print toolbar links sit flush with the "Add room" button.
const ghostLinkClass =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-transparent px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-ink';

export default function RoomsPage() {
  const t = useTranslations('rooms.list');
  const tRooms = useTranslations('rooms');
  const tCommon = useTranslations('common');
  const tG = useTranslations('guidance.rooms');
  const tGc = useTranslations('guidance.common');
  const resolveError = useApiError();
  const locale = useLocale() as Locale;
  const params = useParams<{ slug: string }>();
  const { hasPermission, readOnly } = useTenant();

  const canRead = hasPermission('rooms.read');
  const canCreate = hasPermission('rooms.create');
  const canUpdate = hasPermission('rooms.update');

  const typeName = (rt: { nameEn: string; nameAr: string } | null | undefined) =>
    !rt ? '' : locale === 'ar' ? rt.nameAr : rt.nameEn;

  const [rooms, setRooms] = useState<Room[] | null>(null);
  const [total, setTotal] = useState(0);
  const [usage, setUsage] = useState<{ used: number; max: number | null }>({
    used: 0,
    max: null,
  });
  const [types, setTypes] = useState<RoomType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [floor, setFloor] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Room | null>(null);
  const [qrRoom, setQrRoom] = useState<Room | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (query) qs.set('search', query);
      if (floor) qs.set('floor', floor);
      if (typeFilter) qs.set('typeId', typeFilter);
      if (statusFilter) qs.set('status', statusFilter);
      qs.set('page', String(page));
      qs.set('pageSize', String(PAGE_SIZE));
      const [roomsRes, typesRes] = await Promise.all([
        api<RoomsListResponse>(`/tenant/rooms?${qs.toString()}`),
        api<{ data: RoomType[] }>('/tenant/room-types'),
      ]);
      setRooms(roomsRes.data);
      setTotal(roomsRes.total);
      setUsage(roomsRes.usage);
      setTypes(typesRes.data);
    } catch (err) {
      setError(err instanceof ApiError ? resolveError(err) : t('loadError'));
    } finally {
      setLoading(false);
    }
  }, [query, floor, typeFilter, statusFilter, page, resolveError, t]);

  useEffect(() => {
    if (canRead) load();
  }, [load, canRead]);

  if (!canRead) {
    return (
      <EmptyState
        icon={<ShieldAlert size={28} />}
        title={t('noAccess.title')}
        hint={t('noAccess.hint')}
      />
    );
  }

  const hasFilters = Boolean(query || floor || typeFilter || statusFilter);
  const activeFilterCount =
    (query ? 1 : 0) +
    (floor ? 1 : 0) +
    (typeFilter ? 1 : 0) +
    (statusFilter ? 1 : 0);
  const clearFilters = () => {
    setSearch('');
    setQuery('');
    setFloor('');
    setTypeFilter('');
    setStatusFilter('');
    setPage(1);
  };

  // 11.6 AC3 — the amber threshold mirrors the 4.6 usage-warning pattern;
  // an unlimited plan (max === null) never turns amber.
  const usageAmber =
    usage.max !== null && usage.max > 0 && usage.used / usage.max >= 0.8;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-gold">
            {tRooms('eyebrow')}
          </p>
          <h1 className="mt-1 font-display text-2xl font-semibold text-ink">
            {tRooms('title')}
          </h1>
          <PageIntro>{tG('intro')}</PageIntro>
        </div>
        <Badge tone={usageAmber ? 'warning' : 'neutral'}>
          {usage.max === null
            ? t('usageUnlimited', { used: usage.used })
            : t('usageOf', { used: usage.used, max: usage.max })}
        </Badge>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/t/${params.slug}/rooms/types`} className={ghostLinkClass}>
            {t('header.typesTab')}
          </Link>
          <Link href={`/t/${params.slug}/rooms/qr`} className={ghostLinkClass}>
            {t('header.printQr')}
          </Link>
        </div>
        {canCreate && (
          <Button
            onClick={() => setAdding(true)}
            disabled={readOnly}
            title={readOnly ? tRooms('readOnlyHint') : undefined}
          >
            <Plus size={16} aria-hidden /> {t('header.new')}
          </Button>
        )}
      </div>
      {canCreate && (
        <div className="mt-6">
          <HintCard hintKey="rooms.firstRun" title={tG('firstRunTitle')}>
            {tG('firstRunBody')}
          </HintCard>
        </div>
      )}

      {/* Filters */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <form
          className="flex flex-1 items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setQuery(search.trim());
          }}
        >
          <div className="relative max-w-sm flex-1">
            <Search
              size={15}
              className="absolute start-3 top-1/2 -translate-y-1/2 text-ink-soft/60"
              aria-hidden
            />
            <input
              type="search"
              placeholder={t('search.placeholder')}
              aria-label={t('search.aria')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-line bg-white py-2 pe-3 ps-9 text-sm text-ink"
            />
          </div>
          <Button type="submit" variant="ghost">
            {tCommon('actions.search')}
          </Button>
        </form>
        <input
          type="number"
          aria-label={t('filters.floor')}
          placeholder={t('filters.floor')}
          value={floor}
          onChange={(e) => {
            setPage(1);
            setFloor(e.target.value);
          }}
          className="w-28 rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink"
        />
        <select
          aria-label={t('filters.roomType')}
          className={selectClass}
          value={typeFilter}
          onChange={(e) => {
            setPage(1);
            setTypeFilter(e.target.value);
          }}
        >
          <option value="">{t('filters.allRoomTypes')}</option>
          {types.map((type) => (
            <option key={type.id} value={type.id}>
              {typeName(type)}
            </option>
          ))}
        </select>
        <select
          aria-label={t('filters.status')}
          className={selectClass}
          value={statusFilter}
          onChange={(e) => {
            setPage(1);
            setStatusFilter(e.target.value);
          }}
        >
          <option value="">{t('filters.allStatuses')}</option>
          <option value="active">{tRooms('status.active')}</option>
          <option value="out_of_service">
            {tRooms('status.out_of_service')}
          </option>
          <option value="inactive">{tRooms('status.inactive')}</option>
        </select>
      </div>

      {hasFilters && (
        <div className="mt-3 flex items-center gap-3 text-sm text-ink-soft">
          <span>{tGc('activeFilters', { count: activeFilterCount })}</span>
          <button
            type="button"
            onClick={clearFilters}
            className="font-medium text-ink underline-offset-2 hover:underline"
          >
            {tGc('clearFilters')}
          </button>
        </div>
      )}

      <div className="mt-6">
        {loading ? (
          <p className="text-sm text-ink-soft">{tCommon('states.loading')}</p>
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : !rooms || rooms.length === 0 ? (
          // 11.6 AC4 — a truly empty list is onboarding copy; a filtered-to-
          // zero list offers a clear action instead (12.3 AC3 pattern).
          <EmptyState
            title={hasFilters ? t('empty.noMatchTitle') : t('empty.emptyTitle')}
            hint={hasFilters ? t('empty.noMatchHint') : tG('emptyOnboarding')}
            action={
              hasFilters ? (
                <Button variant="ghost" onClick={clearFilters}>
                  {tGc('clearFilters')}
                </Button>
              ) : canCreate ? (
                <Button onClick={() => setAdding(true)} disabled={readOnly}>
                  {t('header.new')}
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-line bg-white">
            <table className="w-full text-start text-sm">
              <thead className="border-b border-line text-xs uppercase tracking-wide text-ink-soft">
                <tr>
                  <th className="px-4 py-3 font-medium">
                    {t('table.roomNumber')}
                  </th>
                  <th className="px-4 py-3 font-medium">{t('table.floor')}</th>
                  <th className="px-4 py-3 font-medium">
                    {t('table.roomType')}
                  </th>
                  <th className="px-4 py-3 font-medium">{t('table.status')}</th>
                  <th className="px-4 py-3 font-medium">
                    <span className="sr-only">{t('table.actions')}</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rooms.map((room) => (
                  <tr key={room.id}>
                    <td className="px-4 py-3">
                      <Code>{room.roomNumber}</Code>
                    </td>
                    <td className="px-4 py-3 text-ink-soft">
                      {room.floor ?? t('noFloor')}
                    </td>
                    <td className="px-4 py-3 text-ink">
                      {typeName(room.roomType)}
                    </td>
                    <td className="px-4 py-3">
                      {/* Epic 12 drops an occupancy badge here */}
                      <span className="flex items-center gap-2">
                        <Badge tone={STATUS_TONE[room.status]}>
                          {tRooms(`status.${room.status}`)}
                        </Badge>
                        <InfoTip label={tRooms(`status.${room.status}`)}>
                          {tG(`status.${room.status}`)}
                        </InfoTip>
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {canUpdate && (
                          <button
                            onClick={() => setEditing(room)}
                            disabled={readOnly}
                            aria-label={t('row.editAria', {
                              roomNumber: room.roomNumber,
                            })}
                            className="rounded p-1.5 text-ink-soft hover:text-ink disabled:opacity-40"
                          >
                            <Pencil size={15} />
                          </button>
                        )}
                        <button
                          onClick={() => setQrRoom(room)}
                          aria-label={t('row.viewQrAria', {
                            roomNumber: room.roomNumber,
                          })}
                          className="rounded p-1.5 text-ink-soft hover:text-ink disabled:opacity-40"
                        >
                          <QrCode size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination
          total={total}
          page={page}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      </div>

      <AddRoomsModal
        open={adding}
        types={types}
        onClose={() => setAdding(false)}
        onCreated={load}
      />
      <EditRoomModal
        room={editing}
        types={types}
        onClose={() => setEditing(null)}
        onSaved={load}
      />
      <RoomQrModal room={qrRoom} onClose={() => setQrRoom(null)} />
    </div>
  );
}
