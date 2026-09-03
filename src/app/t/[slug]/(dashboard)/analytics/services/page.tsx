'use client';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ExportButton } from '@/components/reports/export-button';
import { ServicesContent } from '@/components/reports/services-content';
import { PeriodSelector } from '@/components/reports/period-selector';
import { usePeriodSelection } from '@/lib/use-period-selection';
import { ErrorState, Skeleton } from '@/components/ui';
import { api } from '@/lib/api';
import { useApiError } from '@/lib/errors';
import type { RequestsReport } from '@/lib/types';

/**
 * Task F2b, Part 3 — the Services (requests report) tab. Story 22.2. The
 * route segment is `services` (this URL is a report), never `requests` —
 * that URL is already the live Requests board; the backend endpoint keeps
 * its own name (`/tenant/reports/requests`), which is intentional (see the
 * task brief's naming note), not a mismatch to fix.
 */
export default function AnalyticsServicesPage() {
  const { slug } = useParams<{ slug: string }>();
  const t = useTranslations('reports');
  const resolveError = useApiError();
  const [period, setPeriod] = usePeriodSelection(`hotello:${slug}:reports-period`);
  const [report, setReport] = useState<RequestsReport | null>(null);
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
      const res = await api<RequestsReport>(`/tenant/reports/requests?${qs}`);
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
        <div className="flex flex-wrap items-center gap-2">
          <ExportButton report="requests" period={period} />
          <ExportButton report="requests-feed" period={period} label={t('exportRawData')} />
        </div>
      </div>
      <div className="mt-6">
        {loading ? (
          <Skeleton className="h-64" />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : report ? (
          <ServicesContent report={report} slug={slug} />
        ) : null}
      </div>
    </div>
  );
}
