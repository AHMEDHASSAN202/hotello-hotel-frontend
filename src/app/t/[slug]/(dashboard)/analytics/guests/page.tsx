'use client';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ExportButton } from '@/components/reports/export-button';
import { GuestsContent } from '@/components/reports/guests-content';
import { PeriodSelector } from '@/components/reports/period-selector';
import { usePeriodSelection } from '@/lib/use-period-selection';
import { ErrorState, Skeleton } from '@/components/ui';
import { api } from '@/lib/api';
import { useApiError } from '@/lib/errors';
import type { GuestsReport } from '@/lib/types';

/** Task F2b, Part 2 — the Guests report tab. Story 22.2. */
export default function AnalyticsGuestsPage() {
  const { slug } = useParams<{ slug: string }>();
  const t = useTranslations('reports');
  const resolveError = useApiError();
  const [period, setPeriod] = usePeriodSelection(`gxp:${slug}:reports-period`);
  const [report, setReport] = useState<GuestsReport | null>(null);
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
      const res = await api<GuestsReport>(`/tenant/reports/guests?${qs}`);
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
          <ExportButton report="guests" period={period} />
          <ExportButton report="stays-feed" period={period} label={t('exportRawData')} />
        </div>
      </div>
      <div className="mt-6">
        {loading ? (
          <Skeleton className="h-64" />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : report ? (
          <GuestsContent report={report} />
        ) : null}
      </div>
    </div>
  );
}
