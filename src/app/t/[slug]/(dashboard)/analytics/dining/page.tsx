'use client';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { DiningContent } from '@/components/reports/dining-content';
import { ExportButton } from '@/components/reports/export-button';
import { PeriodSelector } from '@/components/reports/period-selector';
import { usePeriodSelection } from '@/lib/use-period-selection';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useApiError } from '@/lib/errors';
import type { DiningReport } from '@/lib/types';

/**
 * Task F2c, Part 2 — the Dining revenue tab. Story 22.3.
 *
 * Part 5 (Story 22.6 AC2): the subnav hides this tab's link from a viewer
 * without `reports.revenue` (see `../layout.tsx`), but that's CSS-adjacent
 * UX only — the backend independently 403s `REPORTS_REVENUE_FORBIDDEN` on a
 * direct URL visit, which this page must render as a translated "no access"
 * EmptyState, never the generic ErrorState.
 */
export default function AnalyticsDiningPage() {
  const { slug } = useParams<{ slug: string }>();
  const t = useTranslations('analytics');
  const tReports = useTranslations('reports');
  const resolveError = useApiError();
  const [period, setPeriod] = usePeriodSelection(`hotello:${slug}:reports-period`);
  const [report, setReport] = useState<DiningReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setForbidden(false);
    try {
      const qs = new URLSearchParams({ preset: period.preset });
      if (period.preset === 'custom') {
        if (period.from) qs.set('from', period.from);
        if (period.to) qs.set('to', period.to);
      }
      const res = await api<DiningReport>(`/tenant/reports/dining?${qs}`);
      setReport(res);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'REPORTS_REVENUE_FORBIDDEN') {
        setForbidden(true);
      } else {
        setError(resolveError(err));
      }
    } finally {
      setLoading(false);
    }
  }, [period, resolveError]);

  useEffect(() => {
    void load();
  }, [load]);

  if (forbidden) {
    return (
      <EmptyState
        icon={<ShieldAlert size={28} />}
        title={t('revenue.noAccess.title')}
        hint={t('revenue.noAccess.hint')}
      />
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PeriodSelector value={period} onChange={setPeriod} />
        <div className="flex flex-wrap items-center gap-2">
          <ExportButton report="dining" period={period} />
          <ExportButton report="orders-feed" period={period} label={tReports('exportRawData')} />
        </div>
      </div>
      <div className="mt-6">
        {loading ? (
          <Skeleton className="h-64" />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : report ? (
          <DiningContent report={report} />
        ) : null}
      </div>
    </div>
  );
}
