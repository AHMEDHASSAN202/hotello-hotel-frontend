'use client';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { EventsContent } from '@/components/reports/events-content';
import { PeriodSelector } from '@/components/reports/period-selector';
import { usePeriodSelection } from '@/lib/use-period-selection';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useApiError } from '@/lib/errors';
import type { EventsReport } from '@/lib/types';

/**
 * Task F2c, Part 3 — the Events revenue tab. Story 22.3 AC2.
 *
 * Part 5 (Story 22.6 AC2): same graceful-403 handling as the Dining tab —
 * a REPORTS_REVENUE_FORBIDDEN response renders the "no access" EmptyState,
 * never the generic ErrorState.
 */
export default function AnalyticsEventsPage() {
  const { slug } = useParams<{ slug: string }>();
  const t = useTranslations('analytics');
  const resolveError = useApiError();
  const [period, setPeriod] = usePeriodSelection(`hotello:${slug}:reports-period`);
  const [report, setReport] = useState<EventsReport | null>(null);
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
      const res = await api<EventsReport>(`/tenant/reports/events?${qs}`);
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
      <PeriodSelector value={period} onChange={setPeriod} />
      <div className="mt-6">
        {loading ? (
          <Skeleton className="h-64" />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : report ? (
          <EventsContent report={report} />
        ) : null}
      </div>
    </div>
  );
}
