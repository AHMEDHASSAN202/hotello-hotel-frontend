'use client';

import { useTranslations } from 'next-intl';
import type { FnbWindow } from '@/lib/types';

export const MAX_HOURS_WINDOWS = 4;

/**
 * The daily time-windows editor (Epic 16.2), extracted in Epic 17 so menus
 * and hotel-info facilities share one component. `namespace` must provide
 * `windowsLabel`, `windowsHint`, `addWindow` and `removeWindow`. Windows are
 * hotel-local 'HH:MM'; start > end spans midnight; empty list = always open.
 */
export function HoursEditor({
  value,
  onChange,
  max = MAX_HOURS_WINDOWS,
  namespace,
  disabled = false,
}: {
  value: FnbWindow[];
  onChange: (windows: FnbWindow[]) => void;
  max?: number;
  namespace: string;
  disabled?: boolean;
}) {
  const t = useTranslations(namespace);

  return (
    <div>
      <span className="mb-1 block text-sm font-medium text-ink">
        {t('windowsLabel')}
      </span>
      <p className="mb-2 text-xs text-ink-soft">{t('windowsHint')}</p>
      <div className="space-y-2">
        {value.map((w, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="time"
              required
              disabled={disabled}
              aria-label={`${t('windowsLabel')} ${i + 1}`}
              className="rounded-lg border border-line px-3 py-2 text-sm"
              value={w.start}
              onChange={(e) =>
                onChange(
                  value.map((x, j) =>
                    j === i ? { ...x, start: e.target.value } : x,
                  ),
                )
              }
            />
            <span className="text-ink-soft">–</span>
            <input
              type="time"
              required
              disabled={disabled}
              aria-label={`${t('windowsLabel')} ${i + 1} — ${t('removeWindow')}`}
              className="rounded-lg border border-line px-3 py-2 text-sm"
              value={w.end}
              onChange={(e) =>
                onChange(
                  value.map((x, j) =>
                    j === i ? { ...x, end: e.target.value } : x,
                  ),
                )
              }
            />
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange(value.filter((_, j) => j !== i))}
              className="text-sm text-danger underline-offset-2 hover:underline"
            >
              {t('removeWindow')}
            </button>
          </div>
        ))}
      </div>
      {value.length < max ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange([...value, { start: '07:00', end: '11:00' }])}
          className="mt-2 text-sm font-medium text-ink underline-offset-2 hover:underline"
        >
          {t('addWindow')}
        </button>
      ) : null}
    </div>
  );
}
