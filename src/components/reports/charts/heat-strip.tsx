export interface HeatStripProps {
  hours: number[]; // 24 entries, index = hour
}

/**
 * Task F1b, Part 6 — 24 hourly buckets read better as a styled row than a
 * chart (design note), so this is pure div-based, not Recharts.
 */
export function HeatStrip({ hours }: HeatStripProps) {
  const max = Math.max(1, ...hours);
  return (
    <div className="flex gap-0.5" role="img" aria-label="Busiest hours">
      {hours.map((count, hour) => (
        <div
          key={hour}
          title={`${hour}:00 — ${count}`}
          className="h-8 flex-1 rounded-sm bg-gold"
          style={{ opacity: count === 0 ? 0.08 : 0.25 + 0.75 * (count / max) }}
        />
      ))}
    </div>
  );
}
