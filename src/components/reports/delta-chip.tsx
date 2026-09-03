import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { useTranslations } from 'next-intl';

export interface DeltaChipProps {
  deltaPct?: number;
  /** 'vsPrevious' (default) or 'vsYesterday' — the reports.delta.* key to show alongside the number. */
  labelKey?: 'vsPrevious' | 'vsYesterday';
}

/** Story 22.1 AC6 — renders NOTHING (not a placeholder, not a zero) when `deltaPct` is absent. */
export function DeltaChip({ deltaPct, labelKey = 'vsPrevious' }: DeltaChipProps) {
  const t = useTranslations('reports.delta');
  if (deltaPct === undefined) return null;
  const Icon = deltaPct > 0 ? TrendingUp : deltaPct < 0 ? TrendingDown : Minus;
  const tone = deltaPct > 0 ? 'text-success' : deltaPct < 0 ? 'text-danger' : 'text-ink-soft';
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${tone}`}>
      <Icon size={12} aria-hidden />
      <span className="tabular-nums">{Math.abs(deltaPct)}%</span>
      <span className="text-ink-soft">{t(labelKey)}</span>
    </span>
  );
}
