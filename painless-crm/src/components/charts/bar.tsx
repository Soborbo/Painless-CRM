// Phase 21 — dependency-free horizontal bar chart (CSS widths). Pure
// presentational server component. See ADR-030.

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
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <div className="flex flex-col gap-1.5">
      {data.map((d) => (
        <div key={d.label} className="grid grid-cols-[7rem_1fr_auto] items-center gap-2 text-xs">
          <span className="truncate" title={d.label}>
            {d.label}
          </span>
          <span className="h-2.5 rounded bg-[var(--color-muted)]">
            <span
              className="block h-2.5 rounded bg-[var(--color-primary)]"
              style={{ width: `${(d.value / max) * 100}%` }}
            />
          </span>
          <span className="tabular-nums text-[var(--color-muted-foreground)]">
            {formatValue ? formatValue(d.value) : d.value}
          </span>
        </div>
      ))}
    </div>
  );
}
