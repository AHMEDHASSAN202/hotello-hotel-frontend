'use client';
import dynamic from 'next/dynamic';
import { useLocale, useTranslations } from 'next-intl';
import { BasisFootnote } from './basis-footnote';
import { StatTile } from './stat-tile';
import { Skeleton } from '@/components/ui';
import { useFormatters } from '@/i18n/use-format';
import type { DiningReport } from '@/lib/types';

// Task F6 — all three charts on this tab are Recharts-backed; load them via
// next/dynamic(ssr:false) instead of a static import so they never land in
// the server bundle.
const BarsByDay = dynamic(() => import('./charts/bars-by-day').then((m) => m.BarsByDay), {
  ssr: false,
  loading: () => <Skeleton className="h-60" />,
});
const SplitDonut = dynamic(() => import('./charts/split-donut').then((m) => m.SplitDonut), {
  ssr: false,
  loading: () => <Skeleton className="h-[180px]" />,
});
const TrendLine = dynamic(() => import('./charts/trend-line').then((m) => m.TrendLine), {
  ssr: false,
  loading: () => <Skeleton className="h-60" />,
});

export interface DiningContentProps {
  report: DiningReport;
}

/**
 * Locale-aware name resolution — same convention as `OverviewContent`'s and
 * `ServicesContent`'s `nameFor`: prefer the active locale, fall back to
 * English. The backend sends both languages for these catalog names, so an
 * Arabic-locale viewer must see Arabic names here too (Task F4 — this used
 * to be English-only, unlike the guests/services tabs).
 */
function nameFor(names: Record<string, string>, locale: string): string {
  return (locale === 'ar' ? names.ar : names.en) ?? names.en ?? '';
}

/**
 * The pure presentational body of the Dining report (Task F2c, Part 2),
 * Story 22.3 AC1.
 *
 * NON-NEGOTIABLE (All-Inclusive honesty): `includedConsumption` renders ONLY
 * Item + Qty — it MUST NEVER gain a revenue/amount column, because a
 * ✓Included mojito is a cost to the hotel, not a sale. It is visually and
 * texually separated from the `topItems` ("Top sellers") table — a distinct
 * heading plus an explanatory caption — precisely so nobody reads the two
 * tables as the same kind of thing. Do not "simplify" by merging them or by
 * adding a revenue column here.
 */
export function DiningContent({ report }: DiningContentProps) {
  const t = useTranslations('analytics.dining');
  const tCancelReason = useTranslations('requests.cancelReason');
  const tPaymentMethod = useTranslations('reports.paymentMethod');
  const { formatCurrency, formatNumber } = useFormatters();
  const locale = useLocale();

  return (
    <div className="space-y-8">
      <section data-testid="dining-stats">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatTile label={t('ordersCount')} value={formatNumber(report.ordersCount)} />
          <StatTile
            label={t('revenueTotal')}
            value={formatCurrency(report.revenueTotal, report.currency)}
          />
          <StatTile
            label={t('avgOrderValue')}
            value={
              report.avgOrderValue === null
                ? '—'
                : formatCurrency(report.avgOrderValue, report.currency)
            }
          />
        </div>
      </section>

      <section>
        <BarsByDay
          data={report.revenueByDay}
          xKey="date"
          lines={[{ key: 'revenue', label: t('revenueByDay'), color: '#0E2A47' }]}
        />
        <TrendLine
          data={report.revenueByDay}
          xKey="date"
          lines={[{ key: 'orders', label: t('ordersByDay'), color: '#C8A24A' }]}
        />
      </section>

      {report.topItems.length > 0 && (
        <section>
          <h3 className="mb-3 text-xs font-medium text-ink-soft">{t('topItems')}</h3>
          <div className="overflow-hidden rounded-xl border border-line bg-white">
            <table className="w-full text-start text-sm">
              <thead className="border-b border-line text-xs uppercase tracking-wide text-ink-soft">
                <tr>
                  <th className="px-4 py-3 font-medium">{t('table.item')}</th>
                  <th className="px-4 py-3 font-medium">{t('table.qty')}</th>
                  <th className="px-4 py-3 font-medium">{t('table.revenue')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {report.topItems.map((row) => (
                  <tr key={row.itemId}>
                    <td className="px-4 py-3">{nameFor(row.names, locale)}</td>
                    <td className="px-4 py-3 tabular-nums">{formatNumber(row.qty)}</td>
                    <td className="px-4 py-3 tabular-nums">
                      {formatCurrency(row.revenue, report.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {report.includedConsumption.length > 0 && (
        <section>
          <h3 className="mb-1 text-xs font-medium italic text-ink-soft">
            {t('includedConsumption')}
          </h3>
          <p className="mb-3 max-w-lg text-xs text-ink-soft/80">
            {t('includedConsumptionCaption')}
          </p>
          {/*
            Deliberately no revenue/amount column here — see the module doc
            comment. This table has exactly 2 columns, never 3.
          */}
          <div className="overflow-hidden rounded-xl border border-dashed border-line bg-paper/40">
            <table className="w-full text-start text-sm">
              <thead className="border-b border-line text-xs uppercase tracking-wide text-ink-soft">
                <tr>
                  <th className="px-4 py-3 font-medium">{t('table.item')}</th>
                  <th className="px-4 py-3 font-medium">{t('table.qty')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {report.includedConsumption.map((row) => (
                  <tr key={row.itemId}>
                    <td className="px-4 py-3">{nameFor(row.names, locale)}</td>
                    <td className="px-4 py-3 tabular-nums">{formatNumber(row.qty)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {report.byZone.length > 0 && (
        <section>
          <h3 className="mb-3 text-xs font-medium text-ink-soft">{t('byZone')}</h3>
          <div className="overflow-hidden rounded-xl border border-line bg-white">
            <table className="w-full text-start text-sm">
              <thead className="border-b border-line text-xs uppercase tracking-wide text-ink-soft">
                <tr>
                  <th className="px-4 py-3 font-medium">{t('table.zone')}</th>
                  <th className="px-4 py-3 font-medium">{t('table.revenue')}</th>
                  <th className="px-4 py-3 font-medium">{t('table.orders')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {report.byZone.map((row) => (
                  <tr key={row.locationKey ?? 'room'}>
                    <td className="px-4 py-3">
                      {row.destinationType === 'room'
                        ? t('zoneRoom')
                        : (row.names && nameFor(row.names, locale)) || ''}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {formatCurrency(row.revenue, report.currency)}
                    </td>
                    <td className="px-4 py-3 tabular-nums">{formatNumber(row.orders)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="max-w-sm">
        <h3 className="mb-2 text-xs font-medium text-ink-soft">{t('paymentSplit')}</h3>
        <SplitDonut
          segments={[
            { label: tPaymentMethod('cash'), value: report.paymentSplit.cash, color: '#0E2A47' },
            {
              label: tPaymentMethod('roomCharge'),
              value: report.paymentSplit.roomCharge,
              color: '#C8A24A',
            },
          ]}
        />
      </section>

      <section>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label={t('cancellations')} value={formatNumber(report.cancellations.count)} />
        </div>
        {report.cancellations.reasons.length > 0 && (
          <div className="mt-4 max-w-md">
            <p className="mb-2 text-xs font-medium text-ink-soft">{t('cancellationReasons')}</p>
            <ul className="space-y-1 text-sm text-ink-soft">
              {report.cancellations.reasons.map((r) => (
                <li key={r.reason} className="flex justify-between gap-2">
                  <span>{tCancelReason.has(r.reason) ? tCancelReason(r.reason) : r.reason}</span>
                  <span className="tabular-nums">{formatNumber(r.count)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <BasisFootnote basis={report.basis} />
    </div>
  );
}
