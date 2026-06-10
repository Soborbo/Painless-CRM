// Phase 21 — dependency-free donut chart (inline SVG via stroke-dasharray).
// Pure presentational server component; no client JS. See ADR-030.

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

// A fixed palette so every breakdown chart is colour-consistent. Pages map
// their category keys onto this in order.
export const CHART_COLORS = [
  '#0066cc',
  '#16a34a',
  '#f59e0b',
  '#db2777',
  '#7c3aed',
  '#0891b2',
  '#dc2626',
  '#65a30d',
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
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const radius = (size - thickness) / 2;
  const circ = 2 * Math.PI * radius;
  const cx = size / 2;
  const description = segments.map((s) => `${s.label}: ${s.value}`).join(', ');

  let offset = 0;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={description}
    >
      <title>{description}</title>
      <g transform={`rotate(-90 ${cx} ${cx})`}>
        {/* Track ring — also the whole chart when there is no data. */}
        <circle
          cx={cx}
          cy={cx}
          r={radius}
          fill="none"
          stroke="var(--color-muted)"
          strokeWidth={thickness}
        />
        {total > 0
          ? segments.map((seg) => {
              const len = (seg.value / total) * circ;
              const dash = `${len} ${circ - len}`;
              const el = (
                <circle
                  key={seg.label}
                  cx={cx}
                  cy={cx}
                  r={radius}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={thickness}
                  strokeDasharray={dash}
                  strokeDashoffset={-offset}
                />
              );
              offset += len;
              return el;
            })
          : null}
      </g>
    </svg>
  );
}
