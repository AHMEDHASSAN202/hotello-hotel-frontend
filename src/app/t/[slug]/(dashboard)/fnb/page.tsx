'use client';

import {
  CircleCheck,
  MapPinned,
  Settings2,
  ShieldAlert,
  SlidersHorizontal,
  Volume2,
  VolumeX,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { slaState } from '@/components/board/board-core';
import { useFnbFeed } from '@/components/fnb/fnb-feed-provider';
import { OrderCard, destinationLabel } from '@/components/fnb/order-card';
import { OrderDetailModal } from '@/components/fnb/order-detail-modal';
import { HintCard, InfoTip, PageIntro } from '@/components/guidance';
import { playRequestChime } from '@/components/requests/chime';
import { useTenant } from '@/components/tenant-provider';
import {
  Badge,
  Bdi,
  EmptyState,
  ErrorState,
  Pagination,
  selectClass,
} from '@/components/ui';
import { useFormatters } from '@/i18n/use-format';
import { api } from '@/lib/api';
import { useApiError } from '@/lib/errors';
import type {
  FnbAssignee,
  FnbHistoryResponse,
  FnbLocationsResponse,
  FnbMenusResponse,
  TenantFnbOrder,
} from '@/lib/types';
import { OPEN_FNB_ORDER_STATUSES } from '@/lib/types';

const PAGE_SIZE = 20;
const SOUND_MUTED_HINT = 'fnb.soundMuted';

type ViewTab = 'open' | 'history';

/**
 * The kitchen board (16.7): open orders with overdue floated, destination
 * prominent, payment chips, filters, stats-lite incl. paid revenue today —
 * the number that sells the module. Mirrors the requests board engine.
 */
export default function FnbBoardPage() {
  const t = useTranslations('fnb');
  const tG = useTranslations('guidance.fnb');
  const tGc = useTranslations('guidance.common');
  const resolveError = useApiError();
  const { locale, formatCurrency, formatDateTime } = useFormatters();
  const params = useParams<{ slug: string }>();
  const { me, hasPermission, isHintDismissed, dismissHint, undismissHint } =
    useTenant();
  const canRead = hasPermission('fnb_orders.read');
  const feed = useFnbFeed();

  useEffect(() => feed.boost(), [feed.boost]);

  const soundOn = !isHintDismissed(SOUND_MUTED_HINT);
  const soundOnRef = useRef(soundOn);
  soundOnRef.current = soundOn;
  useEffect(
    () =>
      feed.onNewOrders(() => {
        if (soundOnRef.current) playRequestChime();
      }),
    [feed.onNewOrders],
  );

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const [tab, setTab] = useState<ViewTab>('open');
  const [statusFilter, setStatusFilter] = useState('');
  const [menuFilter, setMenuFilter] = useState('');
  const [destinationFilter, setDestinationFilter] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [detail, setDetail] = useState<TenantFnbOrder | null>(null);

  // Filter sources: menu + location names for every board user.
  const [menus, setMenus] = useState<FnbMenusResponse | null>(null);
  const [locations, setLocations] = useState<FnbLocationsResponse | null>(null);
  const [assignees, setAssignees] = useState<FnbAssignee[]>([]);
  useEffect(() => {
    if (!canRead) return;
    api<FnbMenusResponse>('/tenant/fnb-menus')
      .then(setMenus)
      .catch(() => {});
    api<FnbLocationsResponse>('/tenant/fnb-locations')
      .then(setLocations)
      .catch(() => {});
    api<FnbAssignee[]>('/tenant/fnb-orders/assignees')
      .then(setAssignees)
      .catch(() => {});
  }, [canRead]);

  // History tab — server-side filters + pagination.
  const [history, setHistory] = useState<FnbHistoryResponse | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyPage, setHistoryPage] = useState(1);
  const loadHistory = useCallback(async () => {
    setHistoryError(null);
    try {
      const query = new URLSearchParams({
        tab: 'history',
        page: String(historyPage),
        pageSize: String(PAGE_SIZE),
      });
      if (statusFilter === 'delivered' || statusFilter === 'cancelled') {
        query.set('status', statusFilter);
      }
      if (menuFilter) query.set('menuId', menuFilter);
      if (destinationFilter) query.set('destination', destinationFilter);
      if (assigneeFilter) query.set('assigneeId', assigneeFilter);
      setHistory(await api<FnbHistoryResponse>(`/tenant/fnb-orders?${query}`));
    } catch (err) {
      setHistoryError(resolveError(err));
    }
  }, [
    historyPage,
    statusFilter,
    menuFilter,
    destinationFilter,
    assigneeFilter,
    resolveError,
  ]);
  useEffect(() => {
    if (canRead && tab === 'history') void loadHistory();
  }, [canRead, tab, loadHistory]);

  const nameFor = useCallback(
    (names: { ar?: string; en?: string }) =>
      (locale === 'ar' ? names.ar : names.en) ?? names.en ?? '',
    [locale],
  );

  const openRows = useMemo(() => {
    if (!feed.orders) return null;
    let rows = feed.orders.filter((o) =>
      OPEN_FNB_ORDER_STATUSES.includes(o.status),
    );
    if (statusFilter && OPEN_FNB_ORDER_STATUSES.includes(statusFilter as never)) {
      rows = rows.filter((o) => o.status === statusFilter);
    }
    if (menuFilter) rows = rows.filter((o) => o.menuIds.includes(menuFilter));
    if (destinationFilter === 'room') {
      rows = rows.filter((o) => o.destinationType === 'room');
    } else if (destinationFilter) {
      rows = rows.filter((o) => o.locationId === destinationFilter);
    }
    if (assigneeFilter) {
      rows = rows.filter((o) => o.assignedTo?.id === assigneeFilter);
    }
    if (overdueOnly) {
      rows = rows.filter(
        (o) => slaState(o, now, OPEN_FNB_ORDER_STATUSES) === 'overdue',
      );
    }
    // Overdue floats, newest first within bands (board core rules).
    return [...rows].sort((a, b) => {
      const aOver =
        slaState(a, now, OPEN_FNB_ORDER_STATUSES) === 'overdue' ? 1 : 0;
      const bOver =
        slaState(b, now, OPEN_FNB_ORDER_STATUSES) === 'overdue' ? 1 : 0;
      if (aOver !== bOver) return bOver - aOver;
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [
    feed.orders,
    statusFilter,
    menuFilter,
    destinationFilter,
    assigneeFilter,
    overdueOnly,
    now,
  ]);

  const filterCount =
    Number(Boolean(statusFilter)) +
    Number(Boolean(menuFilter)) +
    Number(Boolean(destinationFilter)) +
    Number(Boolean(assigneeFilter)) +
    Number(overdueOnly);
  const clearFilters = () => {
    setStatusFilter('');
    setMenuFilter('');
    setDestinationFilter('');
    setAssigneeFilter('');
    setOverdueOnly(false);
    setHistoryPage(1);
  };

  if (!canRead) {
    return (
      <EmptyState
        icon={<ShieldAlert size={28} />}
        title={t('board.noAccess.title')}
        hint={t('board.noAccess.hint')}
      />
    );
  }

  const counts = feed.counts;
  const myId = me?.user.id;
  const currency = me?.hotel.currency ?? 'EGP';

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-gold">
            {t('eyebrow')}
          </p>
          <h1 className="mt-1 font-display text-2xl font-semibold text-ink">
            {t('board.title')}
          </h1>
          <PageIntro>{t('board.intro')}</PageIntro>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() =>
              soundOn
                ? dismissHint(SOUND_MUTED_HINT)
                : undismissHint(SOUND_MUTED_HINT)
            }
            aria-pressed={soundOn}
            aria-label={soundOn ? t('board.sound.on') : t('board.sound.off')}
            title={soundOn ? t('board.sound.on') : t('board.sound.off')}
            className="inline-flex items-center justify-center rounded-lg border border-line p-2 text-ink transition-colors hover:border-ink"
          >
            {soundOn ? (
              <Volume2 size={16} aria-hidden />
            ) : (
              <VolumeX size={16} aria-hidden className="text-ink-soft" />
            )}
          </button>
          {hasPermission('fnb_menus.manage') ? (
            <Link
              href={`/t/${params.slug}/fnb/menus`}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-transparent px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-ink"
            >
              <SlidersHorizontal size={14} aria-hidden />
              {t('board.menusLink')}
            </Link>
          ) : null}
          {hasPermission('fnb_locations.manage') ? (
            <Link
              href={`/t/${params.slug}/fnb/locations`}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-transparent px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-ink"
            >
              <MapPinned size={14} aria-hidden />
              {t('board.locationsLink')}
            </Link>
          ) : null}
          {hasPermission('fnb_settings.manage') ? (
            <Link
              href={`/t/${params.slug}/fnb/settings`}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-transparent px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-ink"
            >
              <Settings2 size={14} aria-hidden />
              {t('board.settingsLink')}
            </Link>
          ) : null}
        </div>
      </div>

      {/* 16.7 AC3 — stats-lite incl. the owner number */}
      {counts ? (
        <div className="mt-5 grid max-w-2xl grid-cols-3 gap-3">
          {(
            [
              ['open', String(counts.open), 'gold'],
              ['deliveredToday', String(counts.deliveredToday), 'success'],
              [
                'revenueToday',
                formatCurrency(counts.revenueToday, currency),
                'gold',
              ],
            ] as const
          ).map(([key, value]) => (
            <div
              key={key}
              className="rounded-xl border border-line bg-white px-4 py-3"
            >
              <p className="flex items-center gap-1 text-xs text-ink-soft">
                {t(`board.stats.${key}`)}
                <InfoTip label={t(`board.stats.${key}`)}>
                  {tG(`stats.${key}`)}
                </InfoTip>
              </p>
              <p className="mt-1 font-display text-xl font-semibold tabular-nums text-ink">
                {value}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      <HintCard hintKey="fnb.firstRun" title={t('board.hint.title')}>
        {t('board.hint.body')}
      </HintCard>

      {/* Tabs */}
      <div className="mt-6 flex max-w-xs gap-2 rounded-lg border border-line p-1">
        {(['open', 'history'] as const).map((key) => (
          <button
            key={key}
            aria-pressed={tab === key}
            onClick={() => {
              setTab(key);
              setStatusFilter('');
              setHistoryPage(1);
            }}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === key ? 'bg-ink text-white' : 'text-ink-soft hover:text-ink'
            }`}
          >
            {t(`board.tabs.${key}`)}
          </button>
        ))}
      </div>

      {/* Filters (16.7 AC3) */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setHistoryPage(1);
          }}
          aria-label={t('board.filters.status')}
          className={selectClass}
        >
          <option value="">{t('board.filters.status')}</option>
          {(tab === 'open'
            ? (['new', 'preparing', 'on_the_way'] as const)
            : (['delivered', 'cancelled'] as const)
          ).map((status) => (
            <option key={status} value={status}>
              {t(`board.status.${status}`)}
            </option>
          ))}
        </select>
        <select
          value={menuFilter}
          onChange={(e) => {
            setMenuFilter(e.target.value);
            setHistoryPage(1);
          }}
          aria-label={t('board.filters.menu')}
          className={selectClass}
        >
          <option value="">{t('board.filters.menu')}</option>
          {menus?.menus.map((menu) => (
            <option key={menu.id} value={menu.id}>
              {nameFor(menu.names)}
            </option>
          ))}
        </select>
        <select
          value={destinationFilter}
          onChange={(e) => {
            setDestinationFilter(e.target.value);
            setHistoryPage(1);
          }}
          aria-label={t('board.filters.destination')}
          className={selectClass}
        >
          <option value="">{t('board.filters.destination')}</option>
          <option value="room">{t('board.filters.room')}</option>
          {locations?.locations.map((location) => (
            <option key={location.id} value={location.id}>
              {nameFor(location.names)}
            </option>
          ))}
        </select>
        <select
          value={assigneeFilter}
          onChange={(e) => {
            setAssigneeFilter(e.target.value);
            setHistoryPage(1);
          }}
          aria-label={t('board.filters.assignee')}
          className={selectClass}
        >
          <option value="">{t('board.filters.assignee')}</option>
          {assignees.map((assignee) => (
            <option key={assignee.id} value={assignee.id}>
              {assignee.name}
            </option>
          ))}
        </select>
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
            {t('board.filters.mine')}
          </button>
        ) : null}
        {tab === 'open' ? (
          <button
            aria-pressed={overdueOnly}
            onClick={() => setOverdueOnly((v) => !v)}
            className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
              overdueOnly
                ? 'border-danger bg-danger text-white'
                : 'border-line text-ink-soft hover:border-danger hover:text-danger'
            }`}
          >
            {t('board.filters.overdueOnly')}
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

      {/* Body */}
      {tab === 'open' ? (
        feed.error ? (
          <div className="mt-6">
            <ErrorState
              message={resolveError(feed.error)}
              onRetry={() => void feed.refresh()}
            />
          </div>
        ) : openRows === null ? (
          <p className="mt-6 text-sm text-ink-soft">
            {t('board.states.loading')}
          </p>
        ) : openRows.length === 0 ? (
          <div className="mt-6">
            {filterCount > 0 ? (
              <EmptyState
                title={t('board.empty.filteredTitle')}
                hint={t('board.empty.filteredHint')}
              />
            ) : (
              <EmptyState
                icon={<CircleCheck size={28} />}
                title={t('board.empty.allClearTitle')}
                hint={t('board.empty.allClearHint')}
              />
            )}
          </div>
        ) : (
          <div className="mt-6 grid gap-3">
            {openRows.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                now={now}
                onOpen={setDetail}
              />
            ))}
          </div>
        )
      ) : historyError ? (
        <div className="mt-6">
          <ErrorState message={historyError} onRetry={() => void loadHistory()} />
        </div>
      ) : history === null ? (
        <p className="mt-6 text-sm text-ink-soft">{t('board.states.loading')}</p>
      ) : history.data.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title={t('board.empty.historyTitle')}
            hint={t('board.empty.historyHint')}
          />
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-line bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-paper text-start text-xs uppercase tracking-wider text-ink-soft">
                <th className="px-4 py-3 text-start">
                  {t('board.table.order')}
                </th>
                <th className="px-4 py-3 text-start">
                  {t('board.table.destination')}
                </th>
                <th className="px-4 py-3 text-start">{t('board.table.total')}</th>
                <th className="px-4 py-3 text-start">
                  {t('board.table.status')}
                </th>
                <th className="px-4 py-3 text-start">
                  {t('board.table.finishedAt')}
                </th>
                <th className="px-4 py-3 text-start">
                  {t('board.table.assignee')}
                </th>
              </tr>
            </thead>
            <tbody>
              {history.data.map((order) => (
                <tr
                  key={order.id}
                  onClick={() => setDetail(order)}
                  className="cursor-pointer border-b border-line/60 last:border-0 hover:bg-paper"
                >
                  <td className="px-4 py-3 font-medium text-ink">
                    {order.guestName} · <Bdi>{order.roomNumber}</Bdi>
                  </td>
                  <td className="px-4 py-3">
                    {destinationLabel(order, locale, t)}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {order.totalAmount === 0
                      ? t('payment.included')
                      : formatCurrency(order.totalAmount, order.currency)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      tone={
                        order.status === 'delivered' ? 'success' : 'neutral'
                      }
                    >
                      {t(`board.status.${order.status}`)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-ink-soft">
                    {formatDateTime(
                      order.deliveredAt ?? order.cancelledAt ?? order.updatedAt,
                    )}
                  </td>
                  <td className="px-4 py-3 text-ink-soft">
                    {order.assignedTo?.name ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-3">
            <Pagination
              total={history.total}
              page={historyPage}
              pageSize={PAGE_SIZE}
              onPageChange={setHistoryPage}
            />
          </div>
        </div>
      )}

      <OrderDetailModal
        order={detail}
        onClose={() => setDetail(null)}
        onChanged={(row) => {
          feed.applyRow(row);
          if (tab === 'history') void loadHistory();
        }}
      />
    </div>
  );
}
