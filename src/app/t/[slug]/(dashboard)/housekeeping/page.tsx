'use client';

import {
  CircleCheck,
  ListChecks,
  MoonStar,
  Search,
  Settings2,
  ShieldAlert,
  UserRound,
  Volume2,
  VolumeX,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HintCard, InfoTip, PageIntro } from '@/components/guidance';
import { useHousekeepingFeed } from '@/components/housekeeping/housekeeping-feed-provider';
import { RoomActionModal } from '@/components/housekeeping/room-action-modal';
import { playRequestChime } from '@/components/requests/chime';
import { useTenant } from '@/components/tenant-provider';
import {
  Badge,
  Bdi,
  Button,
  EmptyState,
  ErrorState,
  Skeleton,
  selectClass,
} from '@/components/ui';
import { formatDate } from '@/i18n/format';
import { useFormatters } from '@/i18n/use-format';
import { api } from '@/lib/api';
import { useApiError } from '@/lib/errors';
import type {
  HousekeepingAssignee,
  HousekeepingRoomView,
  HousekeepingStatus,
} from '@/lib/types';

const SOUND_MUTED_HINT = 'housekeeping.soundMuted';

/** Sentinel for the bulk bar's "remove assignment" option. */
const BULK_UNASSIGN = '__unassign__';

const HK_STATUSES: HousekeepingStatus[] = [
  'needs_cleaning',
  'in_progress',
  'clean',
  'dnd',
];

/**
 * Within a floor: checkout flags first, then daily, then in-progress, then
 * DND (parked), then clean — stable, so the server's natural room order
 * survives inside each band (20.2 AC1).
 */
function statusRank(room: HousekeepingRoomView): number {
  switch (room.housekeepingStatus) {
    case 'needs_cleaning':
      return room.cleaningType === 'checkout' ? 0 : 1;
    case 'in_progress':
      return 2;
    case 'dnd':
      return 3;
    default:
      return 4;
  }
}

/** Status color as a start-side border — the scannable axis of the grid. */
function statusBorder(room: HousekeepingRoomView): string {
  switch (room.housekeepingStatus) {
    case 'needs_cleaning':
      return room.cleaningType === 'checkout'
        ? 'border-s-gold'
        : 'border-s-amber-300';
    case 'in_progress':
      return 'border-s-ink';
    case 'dnd':
      return 'border-s-ink-soft';
    default:
      return 'border-s-success';
  }
}

interface FloorGroup {
  /** Null = the "no floor" group, always rendered last. */
  floor: number | null;
  rooms: HousekeepingRoomView[];
}

/**
 * Epic 20 — the housekeeping operations board. Deliberately a ROOM-GRID
 * grouped by floor, not the requests-style card feed (spec note 5): the
 * supervisor scans a hotel map, not a queue. It reuses the shared delta
 * poller + chime/badge infrastructure, and every action is endpoint-shaped
 * so the Staff Task PWA consumes the same backbone later.
 */
export default function HousekeepingPage() {
  const t = useTranslations('housekeeping');
  const tG = useTranslations('guidance.housekeeping');
  const tGc = useTranslations('guidance.common');
  const tCommon = useTranslations('common');
  const resolveError = useApiError();
  const { locale } = useFormatters();
  const params = useParams<{ slug: string }>();
  const { me, hasPermission, readOnly, isHintDismissed, dismissHint, undismissHint } =
    useTenant();
  const canRead = hasPermission('housekeeping.read');
  const canUpdate = hasPermission('housekeeping.update');
  const canAssign = hasPermission('housekeeping.assign');
  const timezone = me?.hotel.timezone ?? 'Africa/Cairo';
  const feed = useHousekeepingFeed();

  // Fast polling while the board is mounted (poller pattern, Epic 15 note 4).
  useEffect(() => {
    if (!canRead) return;
    return feed.boost();
  }, [canRead, feed.boost]);

  // 20.2 — subtle chime when rooms newly flag themselves; per-user toggle.
  const soundOn = !isHintDismissed(SOUND_MUTED_HINT);
  const soundOnRef = useRef(soundOn);
  soundOnRef.current = soundOn;
  useEffect(
    () =>
      feed.onNewlyFlagged(() => {
        if (soundOnRef.current) playRequestChime();
      }),
    [feed.onNewlyFlagged],
  );

  // Filters (20.2 AC3) — all local; the feed always holds the whole board.
  const [floorFilter, setFloorFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [unassignedOnly, setUnassignedOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState<HousekeepingRoomView | null>(null);

  // Assignee options (filter + bulk bar) — options-endpoint pattern.
  const [assignees, setAssignees] = useState<HousekeepingAssignee[]>([]);
  useEffect(() => {
    if (!canRead) return;
    api<HousekeepingAssignee[]>('/tenant/housekeeping/assignees')
      .then(setAssignees)
      .catch(() => {});
  }, [canRead]);

  // Bulk assignment (20.3 AC1) — selection mode + sticky apply bar.
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAssignee, setBulkAssignee] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  const exitSelection = useCallback(() => {
    setSelecting(false);
    setSelectedIds(new Set());
    setBulkAssignee('');
    setBulkError(null);
  }, []);

  const toggleRoomSelected = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  async function applyBulkAssign() {
    setBulkBusy(true);
    setBulkError(null);
    try {
      const rows = await api<HousekeepingRoomView[]>(
        '/tenant/housekeeping/assign-bulk',
        {
          method: 'POST',
          body: JSON.stringify({
            roomIds: Array.from(selectedIds),
            assigneeId: bulkAssignee === BULK_UNASSIGN ? null : bulkAssignee,
          }),
        },
      );
      for (const row of rows) feed.applyRow(row);
      exitSelection();
    } catch (err) {
      setBulkError(resolveError(err));
    } finally {
      setBulkBusy(false);
    }
  }

  const visibleRooms = useMemo(() => {
    if (!feed.rooms) return null;
    let rows = feed.rooms;
    if (floorFilter) {
      rows = rows.filter(
        (r) => (r.floor === null ? 'none' : String(r.floor)) === floorFilter,
      );
    }
    if (statusFilter) {
      rows = rows.filter((r) => r.housekeepingStatus === statusFilter);
    }
    if (typeFilter) rows = rows.filter((r) => r.cleaningType === typeFilter);
    if (assigneeFilter) {
      rows = rows.filter((r) => r.assignedTo?.id === assigneeFilter);
    }
    if (unassignedOnly) rows = rows.filter((r) => r.assignedTo === null);
    return rows;
  }, [
    feed.rooms,
    floorFilter,
    statusFilter,
    typeFilter,
    assigneeFilter,
    unassignedOnly,
  ]);

  // Floor groups in natural order (null floor last), checkout-first inside.
  const groups = useMemo<FloorGroup[] | null>(() => {
    if (!visibleRooms) return null;
    const byFloor = new Map<string, FloorGroup>();
    for (const room of visibleRooms) {
      const key = room.floor === null ? 'none' : String(room.floor);
      const group = byFloor.get(key);
      if (group) group.rooms.push(room);
      else byFloor.set(key, { floor: room.floor, rooms: [room] });
    }
    const list = Array.from(byFloor.values());
    list.sort((a, b) => {
      if (a.floor === null) return b.floor === null ? 0 : 1;
      if (b.floor === null) return -1;
      return a.floor - b.floor;
    });
    for (const group of list) {
      group.rooms = [...group.rooms].sort(
        (a, b) => statusRank(a) - statusRank(b),
      );
    }
    return list;
  }, [visibleRooms]);

  const floorOptions = useMemo(() => {
    const seen = new Set<string>();
    const options: Array<{ value: string; floor: number | null }> = [];
    for (const room of feed.rooms ?? []) {
      const value = room.floor === null ? 'none' : String(room.floor);
      if (seen.has(value)) continue;
      seen.add(value);
      options.push({ value, floor: room.floor });
    }
    options.sort((a, b) => {
      if (a.floor === null) return b.floor === null ? 0 : 1;
      if (b.floor === null) return -1;
      return a.floor - b.floor;
    });
    return options;
  }, [feed.rooms]);

  // 20.2 AC3 — room search HIGHLIGHTS (front-desk "is my room ready?"),
  // it never filters the grid.
  const cardRefs = useRef(new Map<string, HTMLElement>());
  const highlightId = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q || !visibleRooms) return null;
    const exact = visibleRooms.find((r) => r.roomNumber.toLowerCase() === q);
    const match =
      exact ?? visibleRooms.find((r) => r.roomNumber.toLowerCase().includes(q));
    return match?.id ?? null;
  }, [search, visibleRooms]);
  useEffect(() => {
    if (!highlightId) return;
    cardRefs.current
      .get(highlightId)
      ?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  }, [highlightId]);

  const myId = me?.user.id;
  const filterCount =
    Number(Boolean(floorFilter)) +
    Number(Boolean(statusFilter)) +
    Number(Boolean(typeFilter)) +
    Number(Boolean(assigneeFilter)) +
    Number(unassignedOnly);
  const clearFilters = () => {
    setFloorFilter('');
    setStatusFilter('');
    setTypeFilter('');
    setAssigneeFilter('');
    setUnassignedOnly(false);
  };

  if (!canRead) {
    return (
      <EmptyState
        icon={<ShieldAlert size={28} />}
        title={t('noAccess.title')}
        hint={t('noAccess.hint')}
      />
    );
  }

  const counts = feed.counts;

  const lastCleanedTitle = (room: HousekeepingRoomView): string => {
    if (!room.lastCleanedAt) return t('modal.neverCleaned');
    const time = formatDate(room.lastCleanedAt, locale, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: timezone,
    });
    return room.lastCleanedBy
      ? t('modal.lastCleanedBy', { time, name: room.lastCleanedBy.name })
      : t('modal.lastCleaned', { time });
  };

  const toggleFloorSelected = (group: FloorGroup) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allSelected = group.rooms.every((r) => next.has(r.id));
      for (const room of group.rooms) {
        if (allSelected) next.delete(room.id);
        else next.add(room.id);
      }
      return next;
    });
  };

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-gold">
            {t('eyebrow')}
          </p>
          <h1 className="mt-1 font-display text-2xl font-semibold text-ink">
            {t('title')}
          </h1>
          <PageIntro>{t('intro')}</PageIntro>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() =>
              soundOn
                ? dismissHint(SOUND_MUTED_HINT)
                : undismissHint(SOUND_MUTED_HINT)
            }
            aria-pressed={soundOn}
            aria-label={soundOn ? t('sound.on') : t('sound.off')}
            title={soundOn ? t('sound.on') : t('sound.off')}
            className="inline-flex items-center justify-center rounded-lg border border-line p-2 text-ink transition-colors hover:border-ink"
          >
            {soundOn ? (
              <Volume2 size={16} aria-hidden />
            ) : (
              <VolumeX size={16} aria-hidden className="text-ink-soft" />
            )}
          </button>
          {canAssign ? (
            <button
              onClick={() => (selecting ? exitSelection() : setSelecting(true))}
              aria-pressed={selecting}
              className={`inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                selecting
                  ? 'border-ink bg-ink text-white'
                  : 'border-line bg-transparent text-ink hover:border-ink'
              }`}
            >
              <ListChecks size={14} aria-hidden />
              {t('select.enter')}
            </button>
          ) : null}
          {canUpdate ? (
            <Link
              href={`/t/${params.slug}/housekeeping/settings`}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-transparent px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-ink"
            >
              <Settings2 size={14} aria-hidden />
              {t('settingsLink')}
            </Link>
          ) : null}
        </div>
      </div>

      {/* 20.2 AC2 — today at a glance; done-today is the shift progress bar */}
      {counts ? (
        <div className="mt-5 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-line bg-white px-4 py-3">
            <p className="flex items-center gap-1 text-xs text-ink-soft">
              {t('stats.toClean')}
              <InfoTip label={t('stats.toClean')}>{tG('stats.toClean')}</InfoTip>
            </p>
            <p className="mt-1 font-display text-xl font-semibold tabular-nums text-ink">
              {counts.toCleanCheckout + counts.toCleanDaily}
            </p>
            <p className="text-xs tabular-nums text-ink-soft">
              {t('stats.toCleanSplit', {
                checkout: counts.toCleanCheckout,
                daily: counts.toCleanDaily,
              })}
            </p>
          </div>
          <div className="rounded-xl border border-line bg-white px-4 py-3">
            <p className="flex items-center gap-1 text-xs text-ink-soft">
              {t('stats.inProgress')}
              <InfoTip label={t('stats.inProgress')}>
                {tG('stats.inProgress')}
              </InfoTip>
            </p>
            <p className="mt-1 font-display text-xl font-semibold tabular-nums text-ink">
              {counts.inProgress}
            </p>
          </div>
          {/* The supervisor's shift progress bar — visually the loudest tile. */}
          <div className="rounded-xl border border-gold/40 bg-gold-soft px-4 py-3">
            <p className="flex items-center gap-1 text-xs text-ink-soft">
              {t('stats.doneToday')}
              <InfoTip label={t('stats.doneToday')}>
                {tG('stats.doneToday')}
              </InfoTip>
            </p>
            <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-ink">
              {counts.doneToday}
            </p>
          </div>
          <div className="rounded-xl border border-line bg-white px-4 py-3">
            <p className="flex items-center gap-1 text-xs text-ink-soft">
              {t('stats.dnd')}
              <InfoTip label={t('stats.dnd')}>{tG('stats.dnd')}</InfoTip>
            </p>
            <p className="mt-1 flex items-center gap-1.5 font-display text-xl font-semibold tabular-nums text-ink">
              <MoonStar size={16} aria-hidden className="text-ink-soft" />
              {counts.dnd}
            </p>
          </div>
        </div>
      ) : null}

      <HintCard hintKey="housekeeping.firstRun" title={t('hint.title')}>
        {t('hint.body')}
      </HintCard>

      {/* Filters (20.2 AC3) */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search
            size={15}
            className="absolute start-3 top-1/2 -translate-y-1/2 text-ink-soft/60"
            aria-hidden
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('filters.searchPlaceholder')}
            aria-label={t('filters.searchAria')}
            className="w-40 rounded-lg border border-line bg-white py-2 pe-3 ps-9 text-sm text-ink"
          />
        </div>
        <select
          value={floorFilter}
          onChange={(e) => setFloorFilter(e.target.value)}
          aria-label={t('filters.floor')}
          className={selectClass}
        >
          <option value="">{t('filters.floor')}</option>
          {floorOptions.map(({ value, floor }) => (
            <option key={value} value={value}>
              {floor === null ? t('floor.none') : t('floor.label', { floor })}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label={t('filters.status')}
          className={selectClass}
        >
          <option value="">{t('filters.status')}</option>
          {HK_STATUSES.map((status) => (
            <option key={status} value={status}>
              {t(`status.${status}`)}
            </option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          aria-label={t('filters.type')}
          className={selectClass}
        >
          <option value="">{t('filters.type')}</option>
          <option value="checkout">{t('type.checkout')}</option>
          <option value="daily">{t('type.daily')}</option>
        </select>
        <select
          value={assigneeFilter}
          onChange={(e) => setAssigneeFilter(e.target.value)}
          aria-label={t('filters.assignee')}
          className={selectClass}
        >
          <option value="">{t('filters.assignee')}</option>
          {assignees.map((assignee) => (
            <option key={assignee.id} value={assignee.id}>
              {assignee.name}
            </option>
          ))}
        </select>
        <button
          aria-pressed={unassignedOnly}
          onClick={() => setUnassignedOnly((v) => !v)}
          className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
            unassignedOnly
              ? 'border-ink bg-ink text-white'
              : 'border-line text-ink-soft hover:border-ink hover:text-ink'
          }`}
        >
          {t('filters.unassigned')}
        </button>
        {myId ? (
          <button
            aria-pressed={assigneeFilter === myId}
            onClick={() =>
              setAssigneeFilter((prev) => (prev === myId ? '' : myId))
            }
            className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
              assigneeFilter === myId
                ? 'border-ink bg-ink text-white'
                : 'border-line text-ink-soft hover:border-ink hover:text-ink'
            }`}
          >
            {t('filters.mine')}
          </button>
        ) : null}
        {filterCount > 0 ? (
          <button
            onClick={clearFilters}
            className="text-sm font-medium text-ink-soft underline-offset-2 hover:underline"
          >
            {tGc('activeFilters', { count: filterCount })} —{' '}
            {tGc('clearFilters')}
          </button>
        ) : null}
      </div>

      {/* Body — the floor-grouped room grid */}
      {feed.error ? (
        <div className="mt-6">
          <ErrorState
            message={resolveError(feed.error)}
            onRetry={() => void feed.refresh()}
          />
        </div>
      ) : groups === null ? (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="mt-6">
          {filterCount > 0 ? (
            <EmptyState
              title={t('empty.filteredTitle')}
              hint={t('empty.filteredHint')}
            />
          ) : (
            <EmptyState
              icon={<CircleCheck size={28} />}
              title={t('empty.allClearTitle')}
              hint={t('empty.allClearHint')}
            />
          )}
        </div>
      ) : (
        <div className="mt-6 space-y-8">
          {groups.map((group) => (
            <section key={group.floor === null ? 'none' : group.floor}>
              <div className="mb-3 flex items-center gap-3">
                <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-ink-soft">
                  {group.floor === null
                    ? t('floor.none')
                    : t('floor.label', { floor: group.floor })}
                </h2>
                <span className="text-xs tabular-nums text-ink-soft/70">
                  {group.rooms.length}
                </span>
                {selecting ? (
                  <button
                    onClick={() => toggleFloorSelected(group)}
                    className="text-xs font-medium text-ink-soft underline-offset-2 hover:underline"
                  >
                    {group.rooms.every((r) => selectedIds.has(r.id))
                      ? t('select.deselectFloor')
                      : t('select.selectFloor')}
                  </button>
                ) : null}
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                {group.rooms.map((room) => {
                  const selected = selectedIds.has(room.id);
                  return (
                    <button
                      key={room.id}
                      ref={(el) => {
                        if (el) cardRefs.current.set(room.id, el);
                        else cardRefs.current.delete(room.id);
                      }}
                      data-testid={`hk-room-${room.roomNumber}`}
                      onClick={() =>
                        selecting
                          ? toggleRoomSelected(room.id)
                          : setDetail(room)
                      }
                      title={lastCleanedTitle(room)}
                      className={`relative min-h-[5.5rem] animate-banner-in rounded-xl border border-line bg-white p-3 text-start shadow-sm transition-shadow hover:shadow-md border-s-4 ${statusBorder(
                        room,
                      )} ${
                        highlightId === room.id ? 'ring-2 ring-gold' : ''
                      } ${selected ? 'bg-gold-soft/60' : ''}`}
                    >
                      {selecting ? (
                        <input
                          type="checkbox"
                          readOnly
                          checked={selected}
                          aria-label={t('select.roomAria', {
                            room: room.roomNumber,
                          })}
                          className="pointer-events-none absolute end-2 top-2"
                        />
                      ) : null}
                      <div className="flex items-center gap-1.5">
                        <span className="font-display text-lg font-semibold text-ink">
                          <Bdi>{room.roomNumber}</Bdi>
                        </span>
                        {/* Occupancy dot (Epic 13 data) */}
                        <span
                          title={
                            room.occupied
                              ? t('card.occupied')
                              : t('card.vacant')
                          }
                          className={`h-2 w-2 shrink-0 rounded-full ${
                            room.occupied
                              ? 'bg-ink'
                              : 'border border-ink-soft/40 bg-transparent'
                          }`}
                        />
                        {room.housekeepingStatus === 'dnd' ? (
                          <MoonStar
                            size={14}
                            aria-label={t('status.dnd')}
                            className="shrink-0 text-ink-soft"
                          />
                        ) : null}
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1">
                        {room.housekeepingStatus === 'needs_cleaning' &&
                        room.cleaningType ? (
                          <Badge
                            tone={
                              room.cleaningType === 'checkout'
                                ? 'gold'
                                : 'warning'
                            }
                          >
                            {t(`type.${room.cleaningType}`)}
                          </Badge>
                        ) : (
                          <Badge
                            tone={
                              room.housekeepingStatus === 'clean'
                                ? 'success'
                                : room.housekeepingStatus === 'in_progress'
                                  ? 'warning'
                                  : 'neutral'
                            }
                          >
                            {t(`status.${room.housekeepingStatus}`)}
                          </Badge>
                        )}
                        {room.roomStatus === 'out_of_service' ? (
                          <Badge tone="danger">{t('card.outOfService')}</Badge>
                        ) : null}
                      </div>
                      {room.assignedTo ? (
                        <p className="mt-1.5 flex items-center gap-1 truncate text-xs font-medium text-ink-soft">
                          <UserRound size={11} aria-hidden className="shrink-0" />
                          <span className="truncate">
                            {room.assignedTo.name}
                          </span>
                        </p>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Sticky bulk-assign bar (20.3 AC1) */}
      {selecting ? (
        <div className="sticky bottom-4 z-30 mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-white px-4 py-3 shadow-lg">
          <span className="text-sm font-medium tabular-nums text-ink">
            {t('select.selected', { count: selectedIds.size })}
          </span>
          <select
            value={bulkAssignee}
            onChange={(e) => setBulkAssignee(e.target.value)}
            aria-label={t('select.assigneeLabel')}
            className={selectClass}
          >
            <option value="">{t('select.assigneeLabel')}</option>
            {assignees.map((assignee) => (
              <option key={assignee.id} value={assignee.id}>
                {assignee.name}
              </option>
            ))}
            <option value={BULK_UNASSIGN}>{t('select.unassignOption')}</option>
          </select>
          <Button
            onClick={() => void applyBulkAssign()}
            loading={bulkBusy}
            disabled={readOnly || selectedIds.size === 0 || !bulkAssignee}
            title={readOnly ? t('readOnlyHint') : undefined}
          >
            {t('select.apply')}
          </Button>
          <Button variant="ghost" onClick={exitSelection}>
            {tCommon('actions.cancel')}
          </Button>
          {bulkError ? (
            <p role="alert" className="text-sm text-danger">
              {bulkError}
            </p>
          ) : null}
        </div>
      ) : null}

      <RoomActionModal
        room={detail}
        onClose={() => setDetail(null)}
        onChanged={(row) => feed.applyRow(row)}
      />
    </div>
  );
}
