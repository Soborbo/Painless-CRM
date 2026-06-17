'use client';

// Donut chart backed by Recharts <PieChart>. Public API unchanged from the
// previous inline-SVG version so existing call sites need no edits. See ADR-030.
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

// Theme-anchored categorical palette (maps onto --color-chart-* tokens).
// Pages map their category keys onto this in order; it cycles past the fifth.
export const CHART_COLORS = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
  'var(--color-chart-4)',
  'var(--color-chart-5)',
] as const;

export function Donut({
  segments,
  size = 160,
  thickness = 26,
}: {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
}) {
  const outer = size / 2;
  const inner = outer - thickness;
  const data = segments.filter((s) => s.value > 0);
  const description = segments.map((s) => `${s.label}: ${s.value}`).join(', ');
  // When there is no data, render a single full track ring so the chart still
  // occupies its slot rather than collapsing.
  const cells: DonutSegment[] =
    data.length === 0 ? [{ label: '__track__', value: 1, color: 'var(--color-muted)' }] : data;

  return (
    <ResponsiveContainer width={size} height={size}>
      <PieChart role="img" aria-label={description}>
        <Pie
          data={cells}
          dataKey="value"
          nameKey="label"
          cx="50%"
          cy="50%"
          innerRadius={inner}
          outerRadius={outer}
          startAngle={90}
          endAngle={-270}
          stroke="none"
          isAnimationActive={false}
        >
          {cells.map((seg) => (
            <Cell key={seg.label} fill={seg.color} />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
}
