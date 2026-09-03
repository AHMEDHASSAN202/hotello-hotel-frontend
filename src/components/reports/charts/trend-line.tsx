'use client';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export interface TrendLineProps {
  data: Record<string, string | number>[];
  xKey: string;
  lines: { key: string; label: string; color: string }[];
  height?: number;
}

/**
 * Task F1b, Part 6 — day-by-day line chart (occupancy trend, revenue by day).
 * `'use client'` + loaded via `next/dynamic(..., { ssr: false })` at the
 * report page's call site, not here.
 */
export function TrendLine({ data, xKey, lines, height = 240 }: TrendLineProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
        <XAxis dataKey={xKey} tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip />
        <Legend />
        {lines.map((line) => (
          <Line
            key={line.key}
            type="monotone"
            dataKey={line.key}
            name={line.label}
            stroke={line.color}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
