'use client';

import { Plus, Search, ShieldAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { HintCard, InfoTip, PageIntro } from '@/components/guidance';
import { CheckInModal } from '@/components/stays/check-in-modal';
import { StayDetailModal } from '@/components/stays/stay-detail-modal';
import { StaySettingsCard } from '@/components/stays/stay-settings-card';
import { useTenant } from '@/components/tenant-provider';
import {
  Badge,
  Button,
  Code,
  EmptyState,
  ErrorState,
  Pagination,
} from '@/components/ui';
import { useFormatters } from '@/i18n/use-format';
import { api, ApiError } from '@/lib/api';
import { useApiError } from '@/lib/errors';
import type {
  ActiveStaysResponse,
  Stay,
  StaysHistoryResponse,
} from '@/lib/types';

const PAGE_SIZE = 20;

type ViewTab = 'active' | 'history';

export default function StaysPage() {
  const t = useTranslations('stays.list');
  const tCommon = useTranslations('common');
  const tG = useTranslations('guidance.stays');
  const tGc = useTranslations('guidance.common');
  const resolveError = useApiError();
  const { formatDate, formatDateTime } = useFormatters();
  const { hasPermission, readOnly } = useTenant();

  const canRead = hasPermission('stays.read');
  const canCheckin = hasPermission('stays.checkin');
  const canUpdate = hasPermission('stays.update');

  const [tab, setTab] = useState<ViewTab>('active');
  const [stays, setStays] = useState<Stay[] | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [floor, setFloor] = useState('');
  const [page, setPage] = useState(1);

  const [checkingIn, setCheckingIn] = useState(false);
  const [detailStay, setDetailStay] = useState<Stay | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ view: tab });
      if (query) qs.set('search', query);
      if (tab === 'active' && floor) qs.set('floor', floor);
      if (tab === 'history') {
        qs.set('page', String(page));
        qs.set('pageSize', String(PAGE_SIZE));
      }
      const res = await api<ActiveStaysResponse | StaysHistoryResponse>(
        `/tenant/stays?${qs.toString()}`,
      );
      setStays(res.data);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof ApiError ? resolveError(err) : t('loadError'));
    } finally {
      setLoading(false);
    }
  }, [tab, query, floor, page, resolveError, t]);

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

  const hasFilters = Boolean(query || (tab === 'active' && floor));
  const activeFilterCount =
    (query ? 1 : 0) + (tab === 'active' && floor ? 1 : 0);
  const clearFilters = () => {
    setSearch('');
    setQuery('');
    setFloor('');
    setPage(1);
  };
  const switchTab = (next: ViewTab) => {
    if (next === tab) return;
    setTab(next);
    setPage(1);
    setStays(null);
  };

  const tabClass = (v: ViewTab) =>
    `flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
      tab === v ? 'bg-ink text-white' : 'bg-paper text-ink-soft hover:text-ink'
    }`;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-gold">
            {t('eyebrow')}
          </p>
          <h1 className="mt-1 font-display text-2xl font-semibold text-ink">
            {t('title')}
          </h1>
          <PageIntro>{tG('intro')}</PageIntro>
        </div>
        {canCheckin && (
          <Button
            onClick={() => setCheckingIn(true)}
            disabled={readOnly}
            title={readOnly ? t('readOnlyHint') : undefined}
          >
            <Plus size={16} aria-hidden /> {t('checkIn')}
          </Button>
        )}
      </div>

      {canCheckin && (
        <div className="mt-6">
          <HintCard hintKey="stays.firstRun" title={tG('firstRunTitle')}>
            {tG('firstRunBody')}
          </HintCard>
        </div>
      )}

      {/* Active / History tabs — the app's aria-pressed pill pattern. */}
      <div className="mt-6 flex max-w-xs gap-2 rounded-lg border border-line p-1">
        <button
          type="button"
          aria-pressed={tab === 'active'}
          className={tabClass('active')}
          onClick={() => switchTab('active')}
        >
          {t('tabs.active')}
        </button>
        <button
          type="button"
          aria-pressed={tab === 'history'}
          className={tabClass('history')}
          onClick={() => switchTab('history')}
        >
          {t('tabs.history')}
        </button>
      </div>

      {/* Filters */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
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
              placeholder={t('searchPlaceholder')}
              aria-label={t('searchAria')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-line bg-white py-2 pe-3 ps-9 text-sm text-ink"
            />
          </div>
          <Button type="submit" variant="ghost">
            {tCommon('actions.search')}
          </Button>
        </form>
        {tab === 'active' && (
          <input
            type="number"
            aria-label={t('floorAria')}
            placeholder={t('floorPlaceholder')}
            value={floor}
            onChange={(e) => setFloor(e.target.value)}
            className="w-28 rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink"
          />
        )}
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
        ) : !stays || stays.length === 0 ? (
          // 12.3 AC3 — filtered-to-zero and truly-empty are never the same screen.
          <EmptyState
            title={
              hasFilters
                ? t('empty.noMatchTitle')
                : tab === 'history'
                  ? t('empty.historyEmptyTitle')
                  : t('empty.emptyTitle')
            }
            hint={
              hasFilters
                ? t('empty.noMatchHint')
                : tab === 'history'
                  ? t('empty.historyEmptyHint')
                  : tG('emptyOnboarding')
            }
            action={
              hasFilters ? (
                <Button variant="ghost" onClick={clearFilters}>
                  {tGc('clearFilters')}
                </Button>
              ) : tab === 'active' && canCheckin ? (
                <Button
                  onClick={() => setCheckingIn(true)}
                  disabled={readOnly}
                  title={readOnly ? t('readOnlyHint') : undefined}
                >
                  {t('checkIn')}
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-line bg-white">
            <table className="w-full text-start text-sm">
              <thead className="border-b border-line text-xs uppercase tracking-wide text-ink-soft">
                <tr>
                  <th className="px-4 py-3 font-medium">{t('columns.room')}</th>
                  <th className="px-4 py-3 font-medium">{t('columns.guest')}</th>
                  <th className="px-4 py-3 font-medium">{t('columns.dates')}</th>
                  {tab === 'active' ? (
                    <>
                      <th className="px-4 py-3 font-medium">
                        <span className="inline-flex items-center gap-1">
                          {t('columns.nights')}
                          {/* 12.3 AC4 — derived columns explain themselves. */}
                          <InfoTip label={t('columns.nights')}>
                            {tG('nightsColumn')}
                          </InfoTip>
                        </span>
                      </th>
                      <th className="px-4 py-3 font-medium">
                        {t('columns.language')}
                      </th>
                      <th className="px-4 py-3 font-medium">
                        {t('columns.status')}
                      </th>
                    </>
                  ) : (
                    <>
                      <th className="px-4 py-3 font-medium">
                        {t('columns.checkedOutAt')}
                      </th>
                      <th className="px-4 py-3 font-medium">
                        {t('columns.type')}
                      </th>
                    </>
                  )}
                  <th className="px-4 py-3 font-medium">
                    <span className="sr-only">{t('view')}</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {stays.map((stay) => (
                  <tr key={stay.id}>
                    <td className="px-4 py-3">
                      <Code>{stay.roomNumber}</Code>
                    </td>
                    <td className="px-4 py-3 text-ink">{stay.guestName}</td>
                    <td className="px-4 py-3 text-ink-soft">
                      {formatDate(stay.checkInDate)} →{' '}
                      {formatDate(stay.checkOutDate)}
                    </td>
                    {tab === 'active' ? (
                      <>
                        <td className="px-4 py-3 text-ink-soft">
                          {t('nights', { count: stay.nightsRemaining ?? 0 })}
                        </td>
                        <td className="px-4 py-3 text-ink-soft">
                          <LanguageLabel language={stay.language} />
                        </td>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-2">
                            <Badge tone="success">
                              {t(`status.${stay.status}`)}
                            </Badge>
                            <InfoTip label={t(`status.${stay.status}`)}>
                              {tG(`status.${stay.status}`)}
                            </InfoTip>
                          </span>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3 text-ink-soft">
                          {stay.checkedOutAt
                            ? formatDateTime(stay.checkedOutAt)
                            : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-2">
                            <Badge
                              tone={
                                stay.checkoutType === 'automatic'
                                  ? 'neutral'
                                  : 'gold'
                              }
                            >
                              {t(`checkoutType.${stay.checkoutType ?? 'manual'}`)}
                            </Badge>
                            <InfoTip
                              label={t(
                                `checkoutType.${stay.checkoutType ?? 'manual'}`,
                              )}
                            >
                              {tG(
                                `checkoutType.${stay.checkoutType ?? 'manual'}`,
                              )}
                            </InfoTip>
                          </span>
                        </td>
                      </>
                    )}
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <Button
                          variant="ghost"
                          onClick={() => setDetailStay(stay)}
                        >
                          {t('view')}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {tab === 'history' && (
          <Pagination
            total={total}
            page={page}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        )}
      </div>

      {canUpdate && (
        <div className="mt-8">
          <StaySettingsCard />
        </div>
      )}

      <CheckInModal
        open={checkingIn}
        onClose={() => setCheckingIn(false)}
        onCreated={load}
      />
      <StayDetailModal
        stay={detailStay}
        onClose={() => setDetailStay(null)}
        onChanged={load}
      />
    </div>
  );
}

/** The guest's language, in the viewer's language. */
function LanguageLabel({ language }: { language: string }) {
  const t = useTranslations('stays.languages');
  return <span>{t(language as never)}</span>;
}
