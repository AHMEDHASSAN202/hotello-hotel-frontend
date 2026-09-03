'use client';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ExportButton } from '@/components/reports/export-button';
import { OverviewContent } from '@/components/reports/overview-content';
import { PeriodSelector } from '@/components/reports/period-selector';
import { usePeriodSelection } from '@/lib/use-period-selection';
import { useTenant } from '@/components/tenant-provider';
import { ErrorState, Skeleton } from '@/components/ui';
import { api } from '@/lib/api';
import { useApiError } from '@/lib/errors';
import type { OverviewReport } from '@/lib/types';

/** Task F2a, Part 4 — the real (unlocked) Overview report. Story 22.1. */
export default function AnalyticsOverviewPage() {
  const { slug } = useParams<{ slug: string }>();
  const { hasPermission } = useTenant();
  const canReadRevenue = hasPermission('reports.revenue');
  const resolveError = useApiError();
  const [period, setPeriod] = usePeriodSelection(`hotello:${slug}:reports-period`);
  const [report, setReport] = useState<OverviewReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ preset: period.preset });
      if (period.preset === 'custom') {
        if (period.from) qs.set('from', period.from);
        if (period.to) qs.set('to', period.to);
      }
      const res = await api<OverviewReport>(`/tenant/reports/overview?${qs}`);
      setReport(res);
    } catch (err) {
      setError(resolveError(err));
    } finally {
      setLoading(false);
    }
  }, [period, resolveError]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PeriodSelector value={period} onChange={setPeriod} />
        <ExportButton report="overview" period={period} />
      </div>
      <div className="mt-6">
        {loading ? (
          <Skeleton className="h-64" />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : report ? (
          <OverviewContent report={report} canReadRevenue={canReadRevenue} slug={slug} />
        ) : null}
      </div>
    </div>
  );
}
