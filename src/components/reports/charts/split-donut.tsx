'use client';
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

export interface SplitDonutProps {
  segments: { label: string; value: number; color: string }[];
  height?: number;
}

/**
 * Task F1b, Part 6 — a 2-segment donut for cash-vs-room-charge type splits.
 */
export function SplitDonut({ segments, height = 180 }: SplitDonutProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={segments}
          dataKey="value"
          nameKey="label"
          innerRadius="60%"
          outerRadius="85%"
          paddingAngle={2}
          // A static at-a-glance split doesn't need a draw-in animation, and
          // it sidesteps a jsdom test-determinism quirk where Recharts'
          // animated Pie renders a single collapsed sector on first paint.
          isAnimationActive={false}
        >
          {segments.map((segment) => (
            <Cell key={segment.label} fill={segment.color} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
