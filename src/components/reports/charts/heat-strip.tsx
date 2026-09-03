export interface HeatStripProps {
  hours: number[]; // 24 entries, index = hour
  /**
   * Accessible name for the strip — Task F5: the caller supplies a
   * translated string via `useTranslations`; this shared component never
   * hardcodes English (the only place in the epic that used to bypass
   * next-intl).
   */
  label: string;
}

/**
 * Task F1b, Part 6 — 24 hourly buckets read better as a styled row than a
 * chart (design note), so this is pure div-based, not Recharts.
 *
 * The per-bar `title` is hover-only and therefore a nice-to-have enhancement
 * layer ONLY — per this repo's guidance rule ("no hover-only information"),
 * the caller is responsible for surfacing the key information (e.g. the
 * peak hour) as visible text near the strip, not relying on this tooltip.
 */
export function HeatStrip({ hours, label }: HeatStripProps) {
  const max = Math.max(1, ...hours);
  return (
    <div className="flex gap-0.5" role="img" aria-label={label}>
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
