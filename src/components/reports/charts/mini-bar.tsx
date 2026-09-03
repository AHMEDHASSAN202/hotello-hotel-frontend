export interface MiniBarProps {
  data: { label: string; value: number; color?: string }[];
}

/**
 * Task F1b, Part 6 — a compact horizontal bar strip for a small breakdown
 * (stay-type mix, payment split). Hand-rolled flex bars rather than a full
 * Recharts chart — simpler and equally correct for this "mini" presentation,
 * per the brief's own note.
 */
export function MiniBar({ data }: MiniBarProps) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex flex-col gap-2">
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-2 text-xs">
          <span className="w-28 shrink-0 truncate text-ink-soft">{d.label}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-paper">
            <div
              className="h-full rounded-full"
              style={{ width: `${(d.value / max) * 100}%`, backgroundColor: d.color ?? '#0E2A47' }}
            />
          </div>
          <span className="w-10 shrink-0 text-end tabular-nums text-ink">{d.value}</span>
        </div>
      ))}
    </div>
  );
}
