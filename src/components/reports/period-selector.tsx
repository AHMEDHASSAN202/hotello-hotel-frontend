'use client';
import { useTranslations } from 'next-intl';
import type { PeriodSelection } from '@/lib/use-period-selection';
import type { ReportPreset } from '@/lib/types';

const PRESETS: ReportPreset[] = ['today', 'yesterday', 'last7', 'last30', 'custom'];

export interface PeriodSelectorProps {
  value: PeriodSelection;
  onChange: (value: PeriodSelection) => void;
}

/** The `aria-pressed` pill-row idiom already used on the stays/requests tabs. */
export function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  const t = useTranslations('reports.period');
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex gap-2 rounded-lg border border-line p-1">
        {PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            aria-pressed={value.preset === preset}
            onClick={() => onChange(preset === 'custom' ? { preset, from: value.from, to: value.to } : { preset })}
            className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
              value.preset === preset ? 'bg-ink text-white' : 'text-ink-soft hover:bg-paper'
            }`}
          >
            {t(preset)}
          </button>
        ))}
      </div>
      {value.preset === 'custom' && (
        <div className="flex items-center gap-2 text-sm">
          <label className="flex items-center gap-1">
            {t('from')}
            <input
              type="date"
              value={value.from ?? ''}
              onChange={(e) => onChange({ preset: 'custom', from: e.target.value, to: value.to })}
              className="rounded-lg border border-line bg-white px-2 py-1 text-sm text-ink"
            />
          </label>
          <label className="flex items-center gap-1">
            {t('to')}
            <input
              type="date"
              value={value.to ?? ''}
              onChange={(e) => onChange({ preset: 'custom', from: value.from, to: e.target.value })}
              className="rounded-lg border border-line bg-white px-2 py-1 text-sm text-ink"
            />
          </label>
        </div>
      )}
    </div>
  );
}
