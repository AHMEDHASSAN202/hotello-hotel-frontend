'use client';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { MiniBar } from './charts/mini-bar';
import { DeltaChip } from './delta-chip';
import { StatTile } from './stat-tile';
import { Skeleton } from '@/components/ui';
import { useFormatters } from '@/i18n/use-format';
import type { GuestsReport } from '@/lib/types';

// Task F6 — Recharts-backed charts are client-only and heavy; load them via
// next/dynamic(ssr:false) at each call site instead of a static import, so
// they never get pulled into the server bundle. MiniBar is plain flexbox/
// CSS (no Recharts dependency), so it stays a regular static import.
const TrendLine = dynamic(() => import('./charts/trend-line').then((m) => m.TrendLine), {
  ssr: false,
  loading: () => <Skeleton className="h-60" />,
});

export interface GuestsContentProps {
  report: GuestsReport;
}

/**
 * The pure presentational body of the Guests report (Task F2b, Part 2,
 * Story 22.2). Mirrors `OverviewContent`'s shape: stat tiles, a trend chart,
 * and small breakdown bars — no locked/demo-data logic (the layout already
 * handles that for the whole analytics section, per Story 22.6 AC1).
 */
export function GuestsContent({ report }: GuestsContentProps) {
  const t = useTranslations('analytics.guests');
  const tStayTypes = useTranslations('stays.stayTypes');
  const tLanguages = useTranslations('stays.languages');
  const { formatNumber } = useFormatters();

  // Same "vs same time yesterday" honesty labeling as OverviewContent — the
  // backend elapsed-caps yesterday's window when the period is "today".
  const deltaLabel = report.period.preset === 'today' ? ('vsYesterday' as const) : undefined;

  const stayTypeBars = Object.entries(report.stayTypes).map(([key, value]) => ({
    label: tStayTypes.has(key) ? tStayTypes(key) : key,
    value,
  }));
  const languageBars = Object.entries(report.languages).map(([key, value]) => ({
    label: tLanguages.has(key) ? tLanguages(key) : key,
    value,
  }));

  return (
    <div className="space-y-8">
      <section>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatTile
            label={<>{t('arrivals')} <DeltaChip labelKey={deltaLabel} deltaPct={report.arrivals.deltaPct} /></>}
            value={formatNumber(report.arrivals.value)}
          />
          <StatTile
            label={<>{t('departures')} <DeltaChip labelKey={deltaLabel} deltaPct={report.departures.deltaPct} /></>}
            value={formatNumber(report.departures.value)}
          />
          <StatTile label={t('inHouseNow')} value={formatNumber(report.inHouseNow)} />
          <StatTile
            label={t('avgLengthOfStay')}
            value={
              report.avgLengthOfStayDays === null
                ? '—'
                : formatNumber(report.avgLengthOfStayDays)
            }
          />
          <StatTile label={t('roomChanges')} value={formatNumber(report.roomChanges)} />
        </div>
      </section>

      <section>
        <TrendLine
          data={report.occupancyTrend}
          xKey="date"
          lines={[
            { key: 'occupied', label: t('occupied'), color: '#0E2A47' },
            { key: 'totalRooms', label: t('totalRooms'), color: '#9CA3AF' },
          ]}
        />
      </section>

      <section className="grid gap-6 sm:grid-cols-2">
        {stayTypeBars.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium text-ink-soft">{t('stayTypes')}</p>
            <MiniBar data={stayTypeBars} />
          </div>
        )}
        {languageBars.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium text-ink-soft">{t('languages')}</p>
            <MiniBar data={languageBars} />
          </div>
        )}
      </section>
    </div>
  );
}
