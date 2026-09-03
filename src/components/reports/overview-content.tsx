'use client';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { BasisFootnote } from './basis-footnote';
import { MiniBar } from './charts/mini-bar';
import { DeltaChip } from './delta-chip';
import { StatTile } from './stat-tile';
import { useFormatters } from '@/i18n/use-format';
import { staysReportLink } from '@/lib/report-links';
import type { OverviewReport, RequestTranslationMap } from '@/lib/types';

export interface OverviewContentProps {
  report: OverviewReport;
  /** Story 22.6 AC2 — hidden even in the sample preview for a non-revenue viewer. */
  canReadRevenue: boolean;
  /** Task F2d — the one drill-through this task adds: the unsettled-total
   * stat tile links to the stays list pre-filtered to `hasBalance=true`. */
  slug: string;
}

/**
 * Locale-appropriate label from a `{ en, ar, ... }` name map — same
 * en/ar-first fallback used across the dashboard (fnb, hotel-info, events)
 * for these free-form catalog names.
 */
function nameFor(names: RequestTranslationMap, locale: string): string {
  return (locale === 'ar' ? names.ar : names.en) ?? names.en ?? '';
}

/**
 * The pure presentational body of the Overview report (Story 22.1) —
 * consumed by both the locked upsell preview (layout.tsx, fed
 * `DEMO_ANALYTICS`) and the real page (page.tsx, fed fetched data). Knows
 * nothing about which one it's rendering; the "inert sample" treatment and
 * the sample-data label are entirely the caller's responsibility.
 */
export function OverviewContent({ report, canReadRevenue, slug }: OverviewContentProps) {
  const t = useTranslations('analytics.overview');
  const tStayTypes = useTranslations('stays.stayTypes');
  const locale = useLocale();
  const { formatCurrency, formatNumber } = useFormatters();
  const showRevenue = canReadRevenue && Boolean(report.revenue);
  // A "today" period's deltas compare against yesterday truncated to the same
  // elapsed minute (the backend's previousWindow cap) — say so, or a 9 a.m.
  // "-40%" reads as a collapse instead of a partial-day comparison.
  const deltaLabel = report.period.preset === 'today' ? ('vsYesterday' as const) : undefined;

  const stayTypeBars = Object.entries(report.occupancy.stayTypeBreakdown).map(
    ([key, value]) => ({
      label: tStayTypes.has(key) ? tStayTypes(key) : key,
      value,
    }),
  );
  const topItemBars = report.service.topItems.map((item) => ({
    label: nameFor(item.names, locale),
    value: item.count,
  }));

  return (
    <div className="space-y-8">
      {/* Occupancy & guests (22.1 AC2) */}
      <section>
        <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wide text-ink-soft">
          {t('occupancy.heading')}
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatTile
            label={t('occupancy.occupied')}
            value={`${formatNumber(report.occupancy.occupiedNow)}/${formatNumber(report.occupancy.totalRooms)}`}
          />
          <StatTile label={t('occupancy.pct')} value={`${formatNumber(report.occupancy.pct)}%`} />
          <StatTile label={t('occupancy.arrivals')} value={formatNumber(report.occupancy.arrivalsToday)} />
          <StatTile label={t('occupancy.departures')} value={formatNumber(report.occupancy.departuresToday)} />
          <StatTile label={t('occupancy.inHouseGuests')} value={formatNumber(report.occupancy.inHouseGuests)} />
        </div>
        {stayTypeBars.length > 0 && (
          <div className="mt-4 max-w-md">
            <p className="mb-2 text-xs font-medium text-ink-soft">{t('occupancy.byStayType')}</p>
            <MiniBar data={stayTypeBars} />
          </div>
        )}
      </section>

      {/* Service health (22.1 AC3) */}
      <section>
        <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wide text-ink-soft">
          {t('service.heading')}
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatTile
            label={<>{t('service.received')} <DeltaChip labelKey={deltaLabel} deltaPct={report.service.received.deltaPct} /></>}
            value={formatNumber(report.service.received.value)}
          />
          <StatTile
            label={<>{t('service.completed')} <DeltaChip labelKey={deltaLabel} deltaPct={report.service.completed.deltaPct} /></>}
            value={formatNumber(report.service.completed.value)}
          />
          <StatTile label={t('service.openNow')} value={formatNumber(report.service.openNow)} />
          <StatTile
            label={<>{t('service.avgCompletion')} <DeltaChip labelKey={deltaLabel} deltaPct={report.service.avgCompletionMinutes.deltaPct} /></>}
            value={`${formatNumber(report.service.avgCompletionMinutes.value)}m`}
          />
          <StatTile
            label={<>{t('service.slaBreachRate')} <DeltaChip labelKey={deltaLabel} deltaPct={report.service.slaBreachRatePct.deltaPct} /></>}
            value={`${formatNumber(report.service.slaBreachRatePct.value)}%`}
            tone="danger"
          />
        </div>
        {topItemBars.length > 0 && (
          <div className="mt-4 max-w-md">
            <p className="mb-2 text-xs font-medium text-ink-soft">{t('service.topRequested')}</p>
            <MiniBar data={topItemBars} />
          </div>
        )}
      </section>

      {/* Housekeeping pulse (22.1 AC5) */}
      <section>
        <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wide text-ink-soft">
          {t('housekeeping.heading')}
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label={t('housekeeping.cleanedToday')} value={formatNumber(report.housekeeping.cleanedToday)} />
          <StatTile label={t('housekeeping.needingCleaning')} value={formatNumber(report.housekeeping.needingCleaning)} />
          <StatTile label={t('housekeeping.inProgress')} value={formatNumber(report.housekeeping.inProgress)} />
          <StatTile label={t('housekeeping.dnd')} value={formatNumber(report.housekeeping.dnd)} />
        </div>
      </section>

      {/* Revenue strip (22.1 AC4, 22.6 AC2) — ABSENT for non-revenue viewers, sample or real */}
      {showRevenue && report.revenue && (
        <section>
          <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wide text-ink-soft">
            {t('revenue.heading')}
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatTile
              label={<>{t('revenue.dining')} <DeltaChip labelKey={deltaLabel} deltaPct={report.revenue.dining.deltaPct} /></>}
              value={formatCurrency(report.revenue.dining.value, report.currency)}
            />
            <StatTile
              label={<>{t('revenue.events')} <DeltaChip labelKey={deltaLabel} deltaPct={report.revenue.events.deltaPct} /></>}
              value={formatCurrency(report.revenue.events.value, report.currency)}
            />
            <StatTile
              label={<>{t('revenue.total')} <DeltaChip labelKey={deltaLabel} deltaPct={report.revenue.total.deltaPct} /></>}
              value={formatCurrency(report.revenue.total.value, report.currency)}
            />
            <StatTile label={t('revenue.cash')} value={formatCurrency(report.revenue.cash, report.currency)} />
            <StatTile label={t('revenue.roomCharge')} value={formatCurrency(report.revenue.roomCharge, report.currency)} />
            <StatTile
              label={t('revenue.unsettled')}
              value={
                <Link href={staysReportLink(slug, { hasBalance: true })} className="hover:underline">
                  {formatCurrency(report.revenue.unsettledTotal, report.currency)}
                </Link>
              }
            />
          </div>
          <BasisFootnote basis={report.revenue.basis} />
        </section>
      )}
    </div>
  );
}
