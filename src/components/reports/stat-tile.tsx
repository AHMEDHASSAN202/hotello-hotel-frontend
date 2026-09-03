import type { ReactNode } from 'react';

export interface StatTileProps {
  label: ReactNode;
  value: ReactNode;
  /** Danger-red value text when `tone === 'danger'` AND `value` is a number > 0 — the exact rule the requests page already uses. */
  tone?: 'gold' | 'success' | 'danger';
  infoTip?: ReactNode;
}

export function StatTile({ label, value, tone, infoTip }: StatTileProps) {
  const isDanger = tone === 'danger' && typeof value === 'number' && value > 0;
  return (
    <div className="rounded-xl border border-line bg-white px-4 py-3">
      <p className="flex items-center gap-1 text-xs text-ink-soft">
        {label}
        {infoTip}
      </p>
      <p
        className={`mt-1 font-display text-xl font-semibold tabular-nums ${
          isDanger ? 'text-danger' : 'text-ink'
        }`}
      >
        {value}
      </p>
    </div>
  );
}
