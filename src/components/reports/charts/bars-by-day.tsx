'use client';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export interface BarsByDayProps {
  data: Record<string, string | number>[];
  xKey: string;
  lines: { key: string; label: string; color: string }[];
  height?: number;
}

/**
 * Task F1b, Part 6 — same shape as TrendLine, `BarChart`/`Bar` instead of
 * `Line` (order volume by day, etc.).
 */
export function BarsByDay({ data, xKey, lines, height = 240 }: BarsByDayProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
        <XAxis dataKey={xKey} tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip />
        <Legend />
        {lines.map((line) => (
          <Bar
            key={line.key}
            dataKey={line.key}
            name={line.label}
            fill={line.color}
            isAnimationActive={false}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
