'use client';
import { usePathname, useParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { OverviewContent } from '@/components/reports/overview-content';
import { PeriodSelector } from '@/components/reports/period-selector';
import { ModuleUpsell } from '@/components/module-upsell';
import { PageIntro } from '@/components/guidance';
import { useTenant } from '@/components/tenant-provider';
import { DEMO_ANALYTICS } from '@/lib/demo-analytics';

/**
 * Task F2a, Part 3 — Story 22.6 AC1: a locked hotel visiting ANY analytics
 * sub-route sees the SAME Overview sample (the flagship "here's what you
 * get" pitch), never a per-tab sample. This layout intercepts before any
 * child route renders, so Tasks F2b-d's real tab pages never need their own
 * locked/demo logic. The subnav itself is hidden when locked — nowhere to
 * navigate to.
 *
 * Tabs grow across Tasks F2b-d — this array is the single place to add one.
 *
 * `revenueOnly` (Task F2c, Part 1) hides a tab's subnav link from a viewer
 * without `reports.revenue` (the Front Desk case). This is CSS-adjacent UX
 * only — the backend independently 403s `REPORTS_REVENUE_FORBIDDEN` on the
 * route itself regardless of whether the link was visible, so a direct URL
 * visit is still handled (see each revenue page's `forbidden` state).
 */
const TABS: { segment: string; labelKey: string; revenueOnly?: boolean }[] = [
  { segment: '', labelKey: 'overview' },
  { segment: 'guests', labelKey: 'guests' },
  { segment: 'services', labelKey: 'services' },
  { segment: 'housekeeping', labelKey: 'housekeeping' },
  { segment: 'dining', labelKey: 'dining', revenueOnly: true },
  { segment: 'events', labelKey: 'events', revenueOnly: true },
  { segment: 'totals', labelKey: 'totals', revenueOnly: true },
];

export default function AnalyticsLayout({ children }: { children: ReactNode }) {
  const { slug } = useParams<{ slug: string }>();
  const pathname = usePathname();
  const t = useTranslations('analytics');
  // The sample-data pill reuses Task F1b's `reports.sampleDataLabel` — the
  // rest of this component lives in the `analytics` namespace, but that
  // string is the same "sample data" concept `PeriodSelector`'s sibling
  // report screens already use, so it's imported rather than re-copied here.
  const tReports = useTranslations('reports');
  const { isModuleEnabled, hasPermission } = useTenant();
  const locked = !isModuleEnabled('analytics');
  const canReadRevenue = hasPermission('reports.revenue');
  const base = `/t/${slug}/analytics`;
  const visibleTabs = TABS.filter((tab) => !tab.revenueOnly || canReadRevenue);

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-ink">{t('title')}</h1>
      <PageIntro>{t('intro')}</PageIntro>

      {!locked && (
        <nav className="mt-4 flex gap-1 border-b border-line" aria-label={t('tabsLabel')}>
          {visibleTabs.map((tab) => {
            const href = tab.segment ? `${base}/${tab.segment}` : base;
            const active = pathname === href;
            return (
              <Link
                key={tab.labelKey}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`px-3 py-2 text-sm font-medium ${
                  active ? 'border-b-2 border-gold text-ink' : 'text-ink-soft hover:text-ink'
                }`}
              >
                {t(`tabs.${tab.labelKey}`)}
              </Link>
            );
          })}
        </nav>
      )}

      <div className="mt-6">
        {locked ? (
          <ModuleUpsell moduleKey="analytics">
            <p
              data-testid="sample-data-label"
              className="mb-4 inline-block rounded-full bg-gold-soft px-3 py-1 text-xs font-semibold uppercase tracking-wide text-ink"
            >
              {tReports('sampleDataLabel')}
            </p>
            <PeriodSelector value={{ preset: 'last7' }} onChange={() => {}} />
            <div className="mt-6">
              <OverviewContent report={DEMO_ANALYTICS} canReadRevenue={canReadRevenue} />
            </div>
          </ModuleUpsell>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
