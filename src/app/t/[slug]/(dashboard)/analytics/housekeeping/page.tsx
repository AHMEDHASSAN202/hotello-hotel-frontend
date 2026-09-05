'use client';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ExportButton } from '@/components/reports/export-button';
import { HousekeepingContent } from '@/components/reports/housekeeping-content';
import { PeriodSelector } from '@/components/reports/period-selector';
import { usePeriodSelection } from '@/lib/use-period-selection';
import { ErrorState, Skeleton } from '@/components/ui';
import { api } from '@/lib/api';
import { useApiError } from '@/lib/errors';
import type { HousekeepingReport } from '@/lib/types';

/** Task F2b, Part 4 — the Housekeeping report tab. Story 22.2 AC3. */
export default function AnalyticsHousekeepingPage() {
  const { slug } = useParams<{ slug: string }>();
  const resolveError = useApiError();
  const [period, setPeriod] = usePeriodSelection(`gxp:${slug}:reports-period`);
  const [report, setReport] = useState<HousekeepingReport | null>(null);
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
      const res = await api<HousekeepingReport>(`/tenant/reports/housekeeping?${qs}`);
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
        <ExportButton report="housekeeping" period={period} />
      </div>
      <div className="mt-6">
        {loading ? (
          <Skeleton className="h-64" />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : report ? (
          <HousekeepingContent report={report} />
        ) : null}
      </div>
    </div>
  );
}
