'use client';
import { useTranslations } from 'next-intl';
import { BasisFootnote } from './basis-footnote';
import { StatTile } from './stat-tile';
import { useFormatters } from '@/i18n/use-format';
import type { EventPerformance, EventsReport } from '@/lib/types';

export interface EventsContentProps {
  report: EventsReport;
}

/**
 * English-preferred name fallback — same convention as Dining's by-zone
 * table (this epic's backend report-adapter convention), deliberately not
 * the locale-aware `nameFor` used by the guests/services tabs.
 */
function nameFor(titles: Record<string, string>): string {
  return titles.en ?? Object.values(titles)[0] ?? '';
}

/**
 * The pure presentational body of the Events report (Task F2c, Part 3),
 * Story 22.3 AC2.
 *
 * DELIBERATE DISTINCTION from Task F2b's `HousekeepingContent`: that
 * attendants table must NEVER be sorted by completion count (it's a
 * workload view, not a leaderboard). This events table is the OPPOSITE
 * case — Story 22.3 AC2 explicitly wants "best-performing events" as a
 * ranking, so sorting `events` by `revenue` DESCENDING here is the correct,
 * intended behavior. Do not copy housekeeping's "leave API order alone"
 * rule onto this table.
 */
export function EventsContent({ report }: EventsContentProps) {
  const t = useTranslations('analytics.events');
  const { formatCurrency, formatNumber } = useFormatters();

  const sortedEvents: EventPerformance[] = [...report.events].sort(
    (a, b) => b.revenue - a.revenue,
  );

  return (
    <div className="space-y-8">
      <section data-testid="events-stats">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatTile
            label={t('revenue')}
            value={formatCurrency(report.totals.revenue, report.currency)}
          />
          <StatTile label={t('booked')} value={formatNumber(report.totals.booked)} />
          <StatTile
            label={t('cancellationRate')}
            value={`${formatNumber(report.totals.cancellationRatePct)}%`}
          />
        </div>
      </section>

      {sortedEvents.length > 0 && (
        <section>
          <div className="overflow-hidden rounded-xl border border-line bg-white">
            <table className="w-full text-start text-sm">
              <thead className="border-b border-line text-xs uppercase tracking-wide text-ink-soft">
                <tr>
                  <th className="px-4 py-3 font-medium">{t('event')}</th>
                  <th className="px-4 py-3 font-medium">{t('start')}</th>
                  <th className="px-4 py-3 font-medium">{t('booked')}</th>
                  <th className="px-4 py-3 font-medium">{t('capacity')}</th>
                  <th className="px-4 py-3 font-medium">{t('seatsBreakdown')}</th>
                  <th className="px-4 py-3 font-medium">{t('revenue')}</th>
                  <th className="px-4 py-3 font-medium">{t('cancellationRate')}</th>
                </tr>
              </thead>
              {/*
                Sorted by revenue descending above — see the module doc
                comment for why this is the one revenue table that SHOULD
                rank, unlike housekeeping's attendants.
              */}
              <tbody className="divide-y divide-line">
                {sortedEvents.map((row) => (
                  <tr key={row.eventId}>
                    <td className="px-4 py-3 font-medium text-ink">{nameFor(row.titles)}</td>
                    <td className="px-4 py-3">{row.startAtLocal}</td>
                    <td className="px-4 py-3 tabular-nums">{formatNumber(row.booked)}</td>
                    {/* 22.3 AC2 — capacity is nullable (unlimited events). */}
                    <td className="px-4 py-3 tabular-nums">
                      {row.capacity === null ? '—' : formatNumber(row.capacity)}
                    </td>
                    {/* 22.3 AC2 — the paid/free/included breakdown must all be
                        visible together, not folded into a single total. */}
                    <td className="px-4 py-3 text-xs text-ink-soft">
                      <span className="me-2">
                        {t('paidSeats')}: {formatNumber(row.paidSeats)}
                      </span>
                      <span className="me-2">
                        {t('freeSeats')}: {formatNumber(row.freeSeats)}
                      </span>
                      <span>
                        {t('includedSeats')}: {formatNumber(row.includedSeats)}
                      </span>
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {formatCurrency(row.revenue, report.currency)}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {formatNumber(row.cancellationRatePct)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <BasisFootnote basis={report.basis} />
    </div>
  );
}
