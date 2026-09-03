'use client';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { StatTile } from './stat-tile';
import { InfoTip } from '@/components/guidance';
import { Skeleton } from '@/components/ui';
import { useFormatters } from '@/i18n/use-format';
import type { HousekeepingReport } from '@/lib/types';

// Task F6 — Recharts-backed; load via next/dynamic(ssr:false) instead of a
// static import so it never lands in the server bundle.
const BarsByDay = dynamic(() => import('./charts/bars-by-day').then((m) => m.BarsByDay), {
  ssr: false,
  loading: () => <Skeleton className="h-60" />,
});

export interface HousekeepingContentProps {
  report: HousekeepingReport;
}

/**
 * The pure presentational body of the Housekeeping report (Task F2b, Part 4,
 * Story 22.2 AC3).
 *
 * NON-NEGOTIABLE: the attendants table renders `report.attendants` in the
 * order the API returned it — it MUST NOT be re-sorted descending by
 * `completed`. This screen is framed as "understand today's workload
 * distribution", never a performance leaderboard; sorting by "most
 * completed" would visually read as a ranking regardless of the caption or
 * the InfoTip copy next to the heading. Do not "fix" this by adding a sort.
 */
export function HousekeepingContent({ report }: HousekeepingContentProps) {
  const t = useTranslations('analytics.housekeeping');
  const tGuidance = useTranslations('guidance.reports');
  const { formatNumber, formatDate } = useFormatters();

  return (
    <div className="space-y-8">
      <section>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatTile
            label={t('avgFlagToClean')}
            value={
              report.avgFlagToCleanMinutes === null
                ? '—'
                : `${formatNumber(report.avgFlagToCleanMinutes)}m`
            }
          />
          <StatTile label={t('dndCleared')} value={formatNumber(report.dndClearedCount)} />
          <StatTile label={t('dndNow')} value={formatNumber(report.dndNow)} />
        </div>
      </section>

      <section>
        <BarsByDay
          data={report.cleanedByDay}
          xKey="date"
          lines={[
            { key: 'checkout', label: t('checkout'), color: '#0E2A47' },
            { key: 'daily', label: t('daily'), color: '#C8A24A' },
          ]}
        />
      </section>

      <section>
        <div className="mb-3 flex items-center gap-1">
          <h3 className="text-xs font-medium text-ink-soft">{t('attendants')}</h3>
          <InfoTip>{tGuidance('housekeepingWorkload')}</InfoTip>
        </div>
        <div className="overflow-hidden rounded-xl border border-line bg-white">
          <table className="w-full text-start text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wide text-ink-soft">
              <tr>
                <th className="px-4 py-3 font-medium">{t('table.attendant')}</th>
                <th className="px-4 py-3 font-medium">{t('table.completed')}</th>
                <th className="px-4 py-3 font-medium">{t('table.perDay')}</th>
              </tr>
            </thead>
            {/*
              Deliberately no `.sort()` here — see the module doc comment.
              Rows render in `report.attendants`'s own (API) order.
            */}
            <tbody className="divide-y divide-line">
              {report.attendants.map((row) => (
                <tr key={row.userId}>
                  <td className="px-4 py-3 font-medium text-ink">{row.name}</td>
                  <td className="px-4 py-3 tabular-nums">{formatNumber(row.completed)}</td>
                  <td className="px-4 py-3 tabular-nums">{formatNumber(row.perDay)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {report.dataSince && (
        <p data-testid="housekeeping-data-since" className="text-xs italic text-ink-soft">
          {t('dataSince', { date: formatDate(report.dataSince) })}
        </p>
      )}
    </div>
  );
}
