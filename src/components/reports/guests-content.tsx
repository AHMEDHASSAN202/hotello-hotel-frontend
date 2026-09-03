'use client';
import { useTranslations } from 'next-intl';
import { MiniBar } from './charts/mini-bar';
import { TrendLine } from './charts/trend-line';
import { DeltaChip } from './delta-chip';
import { StatTile } from './stat-tile';
import { useFormatters } from '@/i18n/use-format';
import type { GuestsReport } from '@/lib/types';

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
            label={<>{t('arrivals')} <DeltaChip deltaPct={report.arrivals.deltaPct} /></>}
            value={formatNumber(report.arrivals.value)}
          />
          <StatTile
            label={<>{t('departures')} <DeltaChip deltaPct={report.departures.deltaPct} /></>}
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
