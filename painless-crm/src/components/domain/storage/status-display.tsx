import type { ContainerStatus, OccupancySummary } from '@/lib/storage/occupancy';

const STATUS_STYLES: Record<ContainerStatus, string> = {
  available: 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]',
  reserved: 'bg-[var(--color-warning)]/15 text-[var(--color-warning)]',
  occupied: 'bg-[var(--color-primary)]/15 text-[var(--color-primary)]',
  maintenance: 'bg-[var(--color-danger)]/15 text-[var(--color-danger)]',
};

export function ContainerStatusBadge({
  status,
  text,
}: {
  status: ContainerStatus;
  text: string;
}) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}>
      {text}
    </span>
  );
}

// A compact occupancy bar: occupied as a proportion of total, with the figure
// alongside. Used on the sites list and the site detail header.
export function OccupancyBar({
  occupancy,
  label,
}: {
  occupancy: OccupancySummary;
  label: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs text-[var(--color-muted-foreground)]">
        <span>{label}</span>
        <span>
          {occupancy.occupied}/{occupancy.total} · {occupancy.occupancyPct}%
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--color-muted)]">
        <div
          className="h-full bg-[var(--color-primary)]"
          style={{ width: `${occupancy.occupancyPct}%` }}
        />
      </div>
    </div>
  );
}
