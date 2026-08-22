'use client';

import {
  CircleCheck,
  ShieldAlert,
  SlidersHorizontal,
  Volume2,
  VolumeX,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HintCard, InfoTip, PageIntro } from '@/components/guidance';
import { RequestCard } from '@/components/requests/request-card';
import { RequestDetailModal } from '@/components/requests/request-detail-modal';
import { isOpen, orderBoard, slaState } from '@/components/requests/board-logic';
import { playRequestChime } from '@/components/requests/chime';
import { useRequestsFeed } from '@/components/requests/requests-feed-provider';
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
  RequestCatalogResponse,
  RequestAssignee,
  RequestHistoryResponse,
  TenantRequestView,
} from '@/lib/types';

const PAGE_SIZE = 20;
const SOUND_MUTED_HINT = 'requests.soundMuted';

type ViewTab = 'open' | 'history';

/**
 * The live requests board (15.4/15.6): open requests with overdue floated
 * on top, filters, stats-lite header, new-arrival chime (per-user toggle),
 * and the paginated history tab. Data comes from the app-wide requests
 * feed (one poller, boosted to ~10s while this page is mounted).
 */
export default function RequestsPage() {
  const t = useTranslations('requests');
  const tG = useTranslations('guidance.requests');
  const tGc = useTranslations('guidance.common');
  const resolveError = useApiError();
  const { locale, formatDateTime } = useFormatters();
  const params = useParams<{ slug: string }>();
  const { me, hasPermission, isHintDismissed, dismissHint, undismissHint } =
    useTenant();
  const canRead = hasPermission('requests.read');
  const canManageCatalog = hasPermission('request_catalog.manage');
  const feed = useRequestsFeed();

  // Fast polling while the board is mounted (spec note 4).
  useEffect(() => feed.boost(), [feed.boost]);

  // 15.4 AC3 — subtle sound on new arrivals; per-user persisted toggle.
  const soundOn = !isHintDismissed(SOUND_MUTED_HINT);
  const soundOnRef = useRef(soundOn);
  soundOnRef.current = soundOn;
  useEffect(
    () =>
      feed.onNewRequests(() => {
        if (soundOnRef.current) playRequestChime();
      }),
    [feed.onNewRequests],
  );

  // Live clock: ages tick and SLA chips flip between polls (15.6 AC1).
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const [tab, setTab] = useState<ViewTab>('open');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [floorFilter, setFloorFilter] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [detail, setDetail] = useState<TenantRequestView | null>(null);

  // Filter sources: category names for every board user; assignee options.
  const [catalog, setCatalog] = useState<RequestCatalogResponse | null>(null);
  const [assignees, setAssignees] = useState<RequestAssignee[]>([]);
  useEffect(() => {
    if (!canRead) return;
    api<RequestCatalogResponse>('/tenant/request-catalog')
      .then(setCatalog)
      .catch(() => {});
    api<RequestAssignee[]>('/tenant/requests/assignees')
      .then(setAssignees)
      .catch(() => {});
  }, [canRead]);

  // History tab — server-side filters + pagination (final states).
  const [history, setHistory] = useState<RequestHistoryResponse | null>(null);
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
      if (statusFilter === 'done' || statusFilter === 'cancelled') {
        query.set('status', statusFilter);
      }
      if (categoryFilter) query.set('categoryId', categoryFilter);
      if (assigneeFilter) query.set('assigneeId', assigneeFilter);
      if (floorFilter) query.set('floor', floorFilter);
      setHistory(
        await api<RequestHistoryResponse>(`/tenant/requests?${query}`),
      );
    } catch (err) {
      setHistoryError(resolveError(err));
    }
  }, [
    historyPage,
    statusFilter,
    categoryFilter,
    assigneeFilter,
    floorFilter,
    resolveError,
  ]);
  useEffect(() => {
    if (canRead && tab === 'history') void loadHistory();
  }, [canRead, tab, loadHistory]);

  const categoryName = useCallback(
    (names: { ar?: string; en?: string }) =>
      (locale === 'ar' ? names.ar : names.en) ?? names.en ?? '',
    [locale],
  );

  const openRows = useMemo(() => {
    if (!feed.requests) return null;
    let rows = feed.requests.filter(isOpen);
    if (statusFilter === 'new' || statusFilter === 'in_progress') {
      rows = rows.filter((r) => r.status === statusFilter);
    }
    if (categoryFilter) rows = rows.filter((r) => r.categoryId === categoryFilter);
    if (assigneeFilter) {
      rows = rows.filter((r) => r.assignedTo?.id === assigneeFilter);
    }
    if (floorFilter) rows = rows.filter((r) => String(r.floor) === floorFilter);
    if (overdueOnly) rows = rows.filter((r) => slaState(r, now) === 'overdue');
    return orderBoard(rows, now);
  }, [
    feed.requests,
    statusFilter,
    categoryFilter,
    assigneeFilter,
    floorFilter,
    overdueOnly,
    now,
  ]);

  const filterCount =
    Number(Boolean(statusFilter)) +
    Number(Boolean(categoryFilter)) +
    Number(Boolean(assigneeFilter)) +
    Number(Boolean(floorFilter)) +
    Number(overdueOnly);
  const clearFilters = () => {
    setStatusFilter('');
    setCategoryFilter('');
    setAssigneeFilter('');
    setFloorFilter('');
    setOverdueOnly(false);
    setHistoryPage(1);
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
  const myId = me?.user.id;

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
        <div className="flex items-center gap-2">
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
          {canManageCatalog ? (
            <Link
              href={`/t/${params.slug}/requests/catalog`}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-transparent px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-ink"
            >
              <SlidersHorizontal size={14} aria-hidden />
              {t('catalogLink')}
            </Link>
          ) : null}
        </div>
      </div>

      {/* 15.6 AC3 — stats-lite */}
      {counts ? (
        <div className="mt-5 grid max-w-xl grid-cols-3 gap-3">
          {(
            [
              ['open', counts.open, 'gold'],
              ['doneToday', counts.doneToday, 'success'],
              ['overdueNow', counts.overdueNow, 'danger'],
            ] as const
          ).map(([key, value, tone]) => (
            <div
              key={key}
              className="rounded-xl border border-line bg-white px-4 py-3"
            >
              <p className="flex items-center gap-1 text-xs text-ink-soft">
                {t(`stats.${key}`)}
                <InfoTip label={t(`stats.${key}`)}>{tG(`stats.${key}`)}</InfoTip>
              </p>
              <p
                className={`mt-1 font-display text-xl font-semibold tabular-nums ${
                  tone === 'danger' && value > 0 ? 'text-danger' : 'text-ink'
                }`}
              >
                {value}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      <HintCard hintKey="requests.firstRun" title={t('hint.title')}>
        {t('hint.body')}
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
            {t(`tabs.${key}`)}
          </button>
        ))}
      </div>

      {/* Filters (15.4 AC2) */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setHistoryPage(1);
          }}
          aria-label={t('filters.status')}
          className={selectClass}
        >
          <option value="">{t('filters.status')}</option>
          {(tab === 'open'
            ? (['new', 'in_progress'] as const)
            : (['done', 'cancelled'] as const)
          ).map((status) => (
            <option key={status} value={status}>
              {t(`status.${status}`)}
            </option>
          ))}
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => {
            setCategoryFilter(e.target.value);
            setHistoryPage(1);
          }}
          aria-label={t('filters.category')}
          className={selectClass}
        >
          <option value="">{t('filters.category')}</option>
          {catalog?.categories.map((category) => (
            <option key={category.id} value={category.id}>
              {categoryName(category.names)}
            </option>
          ))}
        </select>
        <select
          value={assigneeFilter}
          onChange={(e) => {
            setAssigneeFilter(e.target.value);
            setHistoryPage(1);
          }}
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
        <input
          type="number"
          inputMode="numeric"
          value={floorFilter}
          onChange={(e) => {
            setFloorFilter(e.target.value);
            setHistoryPage(1);
          }}
          placeholder={t('filters.floor')}
          aria-label={t('filters.floor')}
          className="w-24 rounded-lg border border-line px-3 py-2 text-sm"
        />
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
            {t('filters.overdueOnly')}
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
          <p className="mt-6 text-sm text-ink-soft">{t('states.loading')}</p>
        ) : openRows.length === 0 ? (
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
          <div className="mt-6 grid gap-3">
            {openRows.map((request) => (
              <RequestCard
                key={request.id}
                request={request}
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
        <p className="mt-6 text-sm text-ink-soft">{t('states.loading')}</p>
      ) : history.data.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title={t('empty.historyTitle')}
            hint={t('empty.historyHint')}
          />
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-line bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-paper text-start text-xs uppercase tracking-wider text-ink-soft">
                <th className="px-4 py-3 text-start">{t('table.item')}</th>
                <th className="px-4 py-3 text-start">{t('table.room')}</th>
                <th className="px-4 py-3 text-start">{t('table.guest')}</th>
                <th className="px-4 py-3 text-start">{t('table.status')}</th>
                <th className="px-4 py-3 text-start">{t('table.finishedAt')}</th>
                <th className="px-4 py-3 text-start">{t('table.assignee')}</th>
              </tr>
            </thead>
            <tbody>
              {history.data.map((request) => (
                <tr
                  key={request.id}
                  onClick={() => setDetail(request)}
                  className="cursor-pointer border-b border-line/60 last:border-0 hover:bg-paper"
                >
                  <td className="px-4 py-3 font-medium text-ink">
                    {locale === 'ar' ? request.itemNameAr : request.itemNameEn}
                  </td>
                  <td className="px-4 py-3">
                    <Bdi>{request.roomNumber}</Bdi>
                  </td>
                  <td className="px-4 py-3">{request.guestName}</td>
                  <td className="px-4 py-3">
                    <Badge
                      tone={request.status === 'done' ? 'success' : 'neutral'}
                    >
                      {t(`status.${request.status}`)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-ink-soft">
                    {formatDateTime(
                      request.completedAt ??
                        request.cancelledAt ??
                        request.updatedAt,
                    )}
                  </td>
                  <td className="px-4 py-3 text-ink-soft">
                    {request.assignedTo?.name ?? '—'}
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

      <RequestDetailModal
        request={detail}
        onClose={() => setDetail(null)}
        onChanged={(row) => {
          feed.applyRow(row);
          if (tab === 'history') void loadHistory();
        }}
      />
    </div>
  );
}
