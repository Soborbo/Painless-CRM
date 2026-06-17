'use client';

import type * as React from 'react';
import { ResponsiveContainer, Tooltip } from 'recharts';

import { cn } from '@/lib/utils/cn';

export type ChartConfig = Record<
  string,
  {
    label?: React.ReactNode;
    /** Any CSS color, e.g. 'var(--color-chart-1)' or '#f16b21'. */
    color?: string;
  }
>;

/**
 * Wraps a Recharts chart: fixes responsive sizing, applies sane defaults to the
 * SVG primitives (muted grid/axis lines), and exposes each config key as a
 * `--color-<key>` CSS variable so series can reference `var(--color-<key>)`.
 */
export function ChartContainer({
  config,
  className,
  children,
  ...props
}: {
  config: ChartConfig;
  children: React.ReactElement;
} & Omit<React.ComponentProps<'div'>, 'children'>) {
  const colorVars = Object.fromEntries(
    Object.entries(config)
      .filter(([, v]) => v.color)
      .map(([key, v]) => [`--color-${key}`, v.color as string]),
  ) as React.CSSProperties;

  return (
    <div
      data-slot="chart"
      style={colorVars}
      className={cn(
        'flex aspect-video justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line]:stroke-border/50 [&_.recharts-surface]:outline-none',
        className,
      )}
      {...props}
    >
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}

export const ChartTooltip = Tooltip;

interface TooltipPayloadItem {
  name?: string | number;
  value?: string | number;
  dataKey?: string | number;
  color?: string;
}

/** Drop-in `content` for Recharts <Tooltip />. */
export function ChartTooltipContent({
  active,
  payload,
  label,
  config,
  formatValue,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: React.ReactNode;
  config?: ChartConfig;
  formatValue?: (value: number | string) => string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-md border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md">
      {label != null ? <div className="mb-1 font-medium">{label}</div> : null}
      <div className="flex flex-col gap-0.5">
        {payload.map((item, i) => {
          const key = String(item.dataKey ?? item.name ?? i);
          const labelText = config?.[key]?.label ?? item.name ?? key;
          const value = item.value ?? '';
          return (
            <div key={key} className="flex items-center gap-2">
              <span
                className="size-2 shrink-0 rounded-[2px]"
                style={{ backgroundColor: item.color ?? `var(--color-${key})` }}
              />
              <span className="text-muted-foreground">{labelText}</span>
              <span className="ml-auto font-medium tabular-nums">
                {formatValue ? formatValue(value) : value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
