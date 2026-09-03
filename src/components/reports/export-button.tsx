'use client';
import { Download } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui';
import { apiBlob, ApiError, saveBlob } from '@/lib/api';
import { useApiError } from '@/lib/errors';
import type { PeriodSelection } from '@/lib/use-period-selection';

export interface ExportButtonProps {
  /** The backend's `:report`/feed path segment — see the epic's export contract. */
  report: string;
  period: PeriodSelection;
  /** Overrides the default translated "Export" label — used for the CSV "raw data" variant. */
  label?: string;
}

/**
 * Task F3, Part 1 — Story 22.5, the shared export button wired into every
 * report tab's header. Export is a READ, so this button stays enabled under
 * a read-only (expired-trial) subscription, matching the rooms-page export
 * precedent (`src/app/t/[slug]/(dashboard)/rooms/page.tsx`) — no `readOnly`
 * prop/check anywhere in this component.
 */
export function ExportButton({ report, period, label }: ExportButtonProps) {
  const t = useTranslations('reports');
  const resolveError = useApiError();
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setExporting(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ preset: period.preset });
      if (period.preset === 'custom') {
        if (period.from) qs.set('from', period.from);
        if (period.to) qs.set('to', period.to);
      }
      const { blob, filename } = await apiBlob(`/tenant/reports/${report}/export?${qs}`);
      saveBlob(blob, filename ?? `${report}.xlsx`);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'REPORT_EXPORT_ROW_LIMIT') {
        const limit = (err.details as { limit?: number } | undefined)?.limit ?? 10000;
        setError(t('exportRowLimit', { limit }));
      } else {
        setError(err instanceof ApiError ? resolveError(err) : t('exportError'));
      }
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      <Button variant="ghost" onClick={handleExport} loading={exporting}>
        <Download size={15} aria-hidden />
        {label ?? t('export')}
      </Button>
      {error && (
        <p role="alert" className="mt-1 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
