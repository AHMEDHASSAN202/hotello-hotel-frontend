'use client';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { BasisFootnote } from './basis-footnote';
import { StatTile } from './stat-tile';
import { Skeleton } from '@/components/ui';
import { useFormatters } from '@/i18n/use-format';
import type { TotalsReport } from '@/lib/types';

// Task F6 — both charts on this tab are Recharts-backed; load them via
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

export interface TotalsContentProps {
  report: TotalsReport;
}

/**
 * The pure presentational body of the Totals report (Task F2c, Part 4),
 * Story 22.3 AC3.
 *
 * `grandTotal` is rendered as its own oversized headline tile, deliberately
 * NOT alongside `collected`/`outstanding` in the regular StatTile grid — AC3
 * frames it as "the number the owner screenshots", so it needs to visually
 * dominate the screen, not sit at the same weight as the other two figures.
 */
export function TotalsContent({ report }: TotalsContentProps) {
  const t = useTranslations('analytics.totals');
  const tPaymentMethod = useTranslations('reports.paymentMethod');
  const { formatCurrency } = useFormatters();

  return (
    <div className="space-y-8">
      <section>
        <div className="rounded-2xl border-2 border-gold bg-white px-6 py-8 text-center">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">
            {t('grandTotal')}
          </p>
          <p className="mt-2 font-display text-4xl font-bold tabular-nums text-ink">
            {formatCurrency(report.grandTotal, report.currency)}
          </p>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <StatTile
            label={t('collected')}
            value={formatCurrency(report.collected, report.currency)}
          />
          <StatTile
            label={t('outstanding')}
            value={formatCurrency(report.outstanding, report.currency)}
          />
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-xs font-medium text-ink-soft">{t('byDay')}</h3>
        <BarsByDay
          data={report.byDay}
          xKey="date"
          lines={[
            { key: 'dining', label: t('dining'), color: '#0E2A47' },
            { key: 'events', label: t('events'), color: '#C8A24A' },
            { key: 'total', label: t('total'), color: '#7A8895' },
          ]}
        />
      </section>

      <section className="max-w-sm">
        <h3 className="mb-2 text-xs font-medium text-ink-soft">{t('byMethod')}</h3>
        <SplitDonut
          segments={[
            { label: tPaymentMethod('cash'), value: report.byMethod.cash, color: '#0E2A47' },
            {
              label: tPaymentMethod('roomCharge'),
              value: report.byMethod.roomCharge,
              color: '#C8A24A',
            },
          ]}
        />
      </section>

      <BasisFootnote basis={report.basis} />
    </div>
  );
}
