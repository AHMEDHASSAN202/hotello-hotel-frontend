'use client';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { BarsByDay } from './charts/bars-by-day';
import { HeatStrip } from './charts/heat-strip';
import { MiniBar } from './charts/mini-bar';
import { StatTile } from './stat-tile';
import { useFormatters } from '@/i18n/use-format';
import { requestsReportLink } from '@/lib/report-links';
import type { RequestsReport } from '@/lib/types';

export interface ServicesContentProps {
  report: RequestsReport;
  slug: string;
}

/**
 * Locale-appropriate label from a `{ en, ar, ... }` name map — same
 * en/ar-first fallback as `OverviewContent`'s `nameFor` helper.
 */
function nameFor(names: Record<string, string>, locale: string): string {
  return (locale === 'ar' ? names.ar : names.en) ?? names.en ?? '';
}

/**
 * The pure presentational body of the Services (requests) report (Task F2b,
 * Part 3, Story 22.2 — including AC4's drill-through requirement: each
 * category name links to the live Requests board filtered by category and
 * the report's own resolved period).
 */
export function ServicesContent({ report, slug }: ServicesContentProps) {
  const t = useTranslations('analytics.services');
  const tCancelReason = useTranslations('requests.cancelReason');
  const locale = useLocale();
  const { formatNumber } = useFormatters();

  const completionBars = report.completionBuckets.map((b) => ({
    label: b.label,
    value: b.count,
  }));

  return (
    <div className="space-y-8">
      <section>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label={t('received')} value={formatNumber(report.receivedCount)} />
          <StatTile label={t('completed')} value={formatNumber(report.completedCount)} />
          <StatTile
            label={t('slaBreachRate')}
            value={report.overallSlaBreachRatePct === null ? '—' : `${formatNumber(report.overallSlaBreachRatePct)}%`}
            tone="danger"
          />
          <StatTile
            label={t('avgCompletion')}
            value={
              report.overallAvgCompletionMinutes === null
                ? '—'
                : `${formatNumber(report.overallAvgCompletionMinutes)}m`
            }
          />
        </div>
      </section>

      <section>
        <BarsByDay
          data={report.volumeByDay}
          xKey="date"
          lines={[{ key: 'count', label: t('volumeByDay'), color: '#0E2A47' }]}
        />
      </section>

      <section>
        <HeatStrip hours={report.busiestHours} />
      </section>

      {report.byCategory.length > 0 && (
        <section>
          <h3 className="mb-3 text-xs font-medium text-ink-soft">{t('byCategory')}</h3>
          <div className="overflow-hidden rounded-xl border border-line bg-white">
            <table className="w-full text-start text-sm">
              <thead className="border-b border-line text-xs uppercase tracking-wide text-ink-soft">
                <tr>
                  <th className="px-4 py-3 font-medium">{t('table.category')}</th>
                  <th className="px-4 py-3 font-medium">{t('table.count')}</th>
                  <th className="px-4 py-3 font-medium">{t('table.slaCompliance')}</th>
                  <th className="px-4 py-3 font-medium">{t('table.avgCompletion')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {report.byCategory.map((row) => (
                  <tr key={row.categoryId}>
                    <td className="px-4 py-3">
                      <Link
                        href={requestsReportLink(slug, {
                          categoryId: row.categoryId,
                          from: report.period.from,
                          to: report.period.to,
                        })}
                        className="font-medium text-ink hover:underline"
                      >
                        {nameFor(row.names, locale)}
                      </Link>
                    </td>
                    <td className="px-4 py-3 tabular-nums">{formatNumber(row.count)}</td>
                    <td className="px-4 py-3 tabular-nums">
                      {row.slaCompliancePct === null ? '—' : `${formatNumber(row.slaCompliancePct)}%`}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {row.avgCompletionMinutes === null ? '—' : formatNumber(row.avgCompletionMinutes)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {report.byItem.length > 0 && (
        <section>
          <h3 className="mb-3 text-xs font-medium text-ink-soft">{t('byItem')}</h3>
          <div className="overflow-hidden rounded-xl border border-line bg-white">
            <table className="w-full text-start text-sm">
              <thead className="border-b border-line text-xs uppercase tracking-wide text-ink-soft">
                <tr>
                  <th className="px-4 py-3 font-medium">{t('table.item')}</th>
                  <th className="px-4 py-3 font-medium">{t('table.count')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {report.byItem.map((row) => (
                  <tr key={row.itemId}>
                    <td className="px-4 py-3">{nameFor(row.names, locale)}</td>
                    <td className="px-4 py-3 tabular-nums">{formatNumber(row.count)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {completionBars.length > 0 && (
        <section className="max-w-md">
          <h3 className="mb-2 text-xs font-medium text-ink-soft">{t('completionBuckets')}</h3>
          <MiniBar data={completionBars} />
        </section>
      )}

      <section>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label={t('cancellations')} value={formatNumber(report.cancellations.count)} />
        </div>
        {report.cancellations.reasons.length > 0 && (
          <div className="mt-4 max-w-md">
            <p className="mb-2 text-xs font-medium text-ink-soft">{t('cancellationReasons')}</p>
            <MiniBar
              data={report.cancellations.reasons.map((r) => ({
                label: tCancelReason.has(r.reason) ? tCancelReason(r.reason) : r.reason,
                value: r.count,
              }))}
            />
          </div>
        )}
      </section>
    </div>
  );
}
