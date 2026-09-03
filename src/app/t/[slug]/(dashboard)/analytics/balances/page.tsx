'use client';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ExportButton } from '@/components/reports/export-button';
import { PeriodSelector } from '@/components/reports/period-selector';
import { SettleAction } from '@/components/reports/settle-action';
import { useTenant } from '@/components/tenant-provider';
import { Badge, EmptyState, ErrorState, Skeleton } from '@/components/ui';
import { useFormatters } from '@/i18n/use-format';
import { usePeriodSelection } from '@/lib/use-period-selection';
import { api } from '@/lib/api';
import { useApiError } from '@/lib/errors';
import type { BalancesReport, LeakageReport } from '@/lib/types';

type View = 'outstanding' | 'leakage';

/**
 * Task F2d, Part 3 — the Outstanding Balances report tab (Story 22.4). Two
 * local sub-views behind a pill toggle, NOT separate routes:
 *
 * - Outstanding: `GET /tenant/reports/balances`, a live snapshot with NO
 *   period param (the backend's own design — every current stay's balance,
 *   not a historical window). Carries the inline `SettleAction` per row.
 * - Leakage: `GET /tenant/reports/balances/leakage`, period-scoped like every
 *   other report tab — checked-out stays whose balance was never collected,
 *   the "actual loss ledger." No settle action: retroactively settling an
 *   already-checked-out stay isn't part of this flow.
 */
export default function AnalyticsBalancesPage() {
  const { slug } = useParams<{ slug: string }>();
  const t = useTranslations('analytics.balances');
  const resolveError = useApiError();
  const { formatCurrency, formatDate, formatDateTime } = useFormatters();
  const { hasPermission, readOnly } = useTenant();
  const canSettle = hasPermission('stays.checkout');

  const [view, setView] = useState<View>('outstanding');
  const [period, setPeriod] = usePeriodSelection(`hotello:${slug}:reports-period`);

  const [outstanding, setOutstanding] = useState<BalancesReport | null>(null);
  const [outstandingLoading, setOutstandingLoading] = useState(true);
  const [outstandingError, setOutstandingError] = useState<string | null>(null);

  const [leakage, setLeakage] = useState<LeakageReport | null>(null);
  const [leakageLoading, setLeakageLoading] = useState(true);
  const [leakageError, setLeakageError] = useState<string | null>(null);

  const loadOutstanding = useCallback(async () => {
    setOutstandingLoading(true);
    setOutstandingError(null);
    try {
      const res = await api<BalancesReport>('/tenant/reports/balances');
      setOutstanding(res);
    } catch (err) {
      setOutstandingError(resolveError(err));
    } finally {
      setOutstandingLoading(false);
    }
  }, [resolveError]);

  const loadLeakage = useCallback(async () => {
    setLeakageLoading(true);
    setLeakageError(null);
    try {
      const qs = new URLSearchParams({ preset: period.preset });
      if (period.preset === 'custom') {
        if (period.from) qs.set('from', period.from);
        if (period.to) qs.set('to', period.to);
      }
      const res = await api<LeakageReport>(`/tenant/reports/balances/leakage?${qs}`);
      setLeakage(res);
    } catch (err) {
      setLeakageError(resolveError(err));
    } finally {
      setLeakageLoading(false);
    }
  }, [period, resolveError]);

  // Outstanding is the default view — fetched whenever it's active.
  useEffect(() => {
    if (view === 'outstanding') void loadOutstanding();
  }, [view, loadOutstanding]);

  // Leakage is period-scoped and fetched lazily — only once the viewer
  // actually switches to it (or changes the period while already there).
  useEffect(() => {
    if (view === 'leakage') void loadLeakage();
  }, [view, loadLeakage]);

  const tabClass = (v: View) =>
    `flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
      view === v ? 'bg-ink text-white' : 'bg-paper text-ink-soft hover:text-ink'
    }`;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex max-w-xs gap-2 rounded-lg border border-line p-1">
          <button
            type="button"
            aria-pressed={view === 'outstanding'}
            className={tabClass('outstanding')}
            onClick={() => setView('outstanding')}
          >
            {t('outstandingTab')}
          </button>
          <button
            type="button"
            aria-pressed={view === 'leakage'}
            className={tabClass('leakage')}
            onClick={() => setView('leakage')}
          >
            {t('leakageTab')}
          </button>
        </div>
        {/* Task F3, Part 2 — outstanding has NO on-screen period selector (a
            live snapshot); its export still needs SOME resolved period for
            the backend's filename/header line even though the data itself
            ignores it (verified against ReportsExportService.exportReport's
            `balances` case), so a fixed `today` preset is passed. Leakage
            reuses the shared `period` state its own PeriodSelector controls. */}
        <ExportButton
          report={view === 'outstanding' ? 'balances' : 'leakage'}
          period={view === 'outstanding' ? { preset: 'today' } : period}
        />
      </div>

      {view === 'outstanding' ? (
        <div className="mt-6">
          {outstandingLoading ? (
            <Skeleton className="h-64" />
          ) : outstandingError ? (
            <ErrorState message={outstandingError} onRetry={loadOutstanding} />
          ) : outstanding ? (
            <div>
              {/* Story 22.4 AC2 — "3 rooms departing today have balances" framing, flagged amber. */}
              <div className="flex flex-wrap gap-3">
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <p className="text-xs font-medium text-amber-700">{t('departingToday')}</p>
                  <p className="mt-1 font-display text-xl font-semibold tabular-nums text-amber-800">
                    {outstanding.departingTodayCount}
                  </p>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <p className="text-xs font-medium text-amber-700">{t('departingTodayTotal')}</p>
                  <p className="mt-1 font-display text-xl font-semibold tabular-nums text-amber-800">
                    {formatCurrency(outstanding.departingTodayTotal, outstanding.currency)}
                  </p>
                </div>
              </div>

              <div className="mt-6">
                {outstanding.rows.length === 0 ? (
                  <EmptyState title={t('empty.outstandingTitle')} hint={t('empty.outstandingHint')} />
                ) : (
                  <div className="overflow-hidden rounded-xl border border-line bg-white">
                    <table className="w-full text-start text-sm">
                      <thead className="border-b border-line text-xs uppercase tracking-wide text-ink-soft">
                        <tr>
                          <th className="px-4 py-3 font-medium">{t('room')}</th>
                          <th className="px-4 py-3 font-medium">{t('guest')}</th>
                          <th className="px-4 py-3 font-medium">{t('checkoutDate')}</th>
                          <th className="px-4 py-3 font-medium">{t('total')}</th>
                          <th className="px-4 py-3 font-medium">{t('dining')}</th>
                          <th className="px-4 py-3 font-medium">{t('events')}</th>
                          <th className="px-4 py-3 font-medium">
                            <span className="sr-only">{t('settle')}</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {/* Already checkout-date-ascending from the API — never re-sorted here. */}
                        {outstanding.rows.map((row) => (
                          <tr key={row.stayId}>
                            <td className="px-4 py-3 text-ink">{row.roomNumber}</td>
                            <td className="px-4 py-3 text-ink">{row.guestName}</td>
                            <td className="px-4 py-3">
                              {row.departsToday ? (
                                <Badge tone="warning">{formatDate(row.checkOutDate)}</Badge>
                              ) : (
                                <span className="text-ink-soft">{formatDate(row.checkOutDate)}</span>
                              )}
                            </td>
                            <td className="px-4 py-3 tabular-nums text-ink">
                              {formatCurrency(row.total, outstanding.currency)}
                            </td>
                            <td className="px-4 py-3 tabular-nums text-ink-soft">
                              {formatCurrency(row.byKey.fnb ?? 0, outstanding.currency)}
                            </td>
                            <td className="px-4 py-3 tabular-nums text-ink-soft">
                              {formatCurrency(row.byKey.events ?? 0, outstanding.currency)}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex justify-end">
                                <SettleAction
                                  stayId={row.stayId}
                                  amount={row.total}
                                  currency={outstanding.currency}
                                  disabled={!canSettle || readOnly}
                                  // Simplest correct approach — re-fetch rather than patch
                                  // in place, since settling can partially clear a balance
                                  // if a new charge landed mid-flight (the backend's own
                                  // documented settle() race).
                                  onSettled={loadOutstanding}
                                />
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-6">
          <PeriodSelector value={period} onChange={setPeriod} />
          <div className="mt-6">
            {leakageLoading ? (
              <Skeleton className="h-64" />
            ) : leakageError ? (
              <ErrorState message={leakageError} onRetry={loadLeakage} />
            ) : leakage ? (
              <div>
                <div className="rounded-xl border border-line bg-white px-4 py-3">
                  <p className="text-xs text-ink-soft">{t('totalLost')}</p>
                  <p className="mt-1 font-display text-xl font-semibold tabular-nums text-danger">
                    {formatCurrency(leakage.totalLost, leakage.currency)}
                  </p>
                </div>

                <div className="mt-6">
                  {leakage.rows.length === 0 ? (
                    <EmptyState title={t('empty.leakageTitle')} hint={t('empty.leakageHint')} />
                  ) : (
                    <div className="overflow-hidden rounded-xl border border-line bg-white">
                      <table className="w-full text-start text-sm">
                        <thead className="border-b border-line text-xs uppercase tracking-wide text-ink-soft">
                          <tr>
                            <th className="px-4 py-3 font-medium">{t('room')}</th>
                            <th className="px-4 py-3 font-medium">{t('guest')}</th>
                            <th className="px-4 py-3 font-medium">{t('checkedOutAt')}</th>
                            <th className="px-4 py-3 font-medium">{t('type')}</th>
                            <th className="px-4 py-3 font-medium">{t('total')}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                          {leakage.rows.map((row) => (
                            <tr key={row.stayId}>
                              <td className="px-4 py-3 text-ink">{row.roomNumber}</td>
                              <td className="px-4 py-3 text-ink">{row.guestName}</td>
                              <td className="px-4 py-3 text-ink-soft">{formatDateTime(row.checkedOutAt)}</td>
                              <td className="px-4 py-3">
                                <Badge tone={row.checkoutType === 'automatic' ? 'neutral' : 'gold'}>
                                  {t(`checkoutType.${row.checkoutType}`)}
                                </Badge>
                              </td>
                              <td className="px-4 py-3 tabular-nums text-ink">
                                {formatCurrency(row.total, leakage.currency)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
