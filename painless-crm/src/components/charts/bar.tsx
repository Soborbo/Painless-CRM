'use client';

// Horizontal bar chart backed by Recharts. Public API unchanged from the
// previous CSS-only version so existing call sites need no edits. See ADR-030.
import { Bar, LabelList, BarChart as RBarChart, ResponsiveContainer, XAxis, YAxis } from 'recharts';

export interface BarDatum {
  label: string;
  value: number;
}

export function BarChart({
  data,
  formatValue,
}: {
  data: BarDatum[];
  formatValue?: (value: number) => string;
}) {
  if (data.length === 0) {
    return <p className="text-sm text-[var(--color-muted-foreground)]">—</p>;
  }
  const height = Math.max(96, data.length * 32 + 8);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RBarChart data={data} layout="vertical" margin={{ top: 4, right: 52, bottom: 4, left: 4 }}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="label"
          width={112}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 12, fill: 'var(--color-muted-foreground)' }}
        />
        <Bar dataKey="value" fill="var(--color-primary)" radius={[0, 3, 3, 0]} maxBarSize={14}>
          <LabelList
            dataKey="value"
            position="right"
            fill="var(--color-muted-foreground)"
            fontSize={12}
            formatter={(value) =>
              formatValue ? formatValue(Number(value ?? 0)) : String(value ?? '')
            }
          />
        </Bar>
      </RBarChart>
    </ResponsiveContainer>
  );
}
