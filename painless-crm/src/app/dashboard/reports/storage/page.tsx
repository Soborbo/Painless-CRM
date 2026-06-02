import { requireRole } from '@/lib/auth/require-role';
import { type ProfitRange, resolveRange } from '@/lib/jobs/profit-dashboard';
import { listAllContainerStatuses } from '@/lib/queries/storage';
import { listRentalsForReport } from '@/lib/queries/storage-rental';
import { buildStorageReport } from '@/lib/reports/storage';
import { summariseOccupancy } from '@/lib/storage/occupancy';
import { formatDate, formatPence } from '@/lib/utils/format';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

const REPORT_ROLES = ['manager', 'admin', 'super_admin'] as const;
const VALID_RANGES = ['month', 'quarter'] as const satisfies readonly ProfitRange[];

export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<{ range?: string }> };

function parseRange(value: string | undefined): ProfitRange {
  return (VALID_RANGES as readonly string[]).includes(value ?? '')
    ? (value as ProfitRange)
    : 'month';
}

function fmtPct(value: number | null): string {
  return value === null ? '—' : `${value.toFixed(1)}%`;
}

function signedPence(pence: number): string {
  return `${pence > 0 ? '+' : ''}${formatPence(pence)}`;
}

export default async function StorageReportPage({ searchParams }: Props) {
  await requireRole(REPORT_ROLES);
  const { range: rangeParam } = await searchParams;
  const range = parseRange(rangeParam);
  const window = resolveRange(range, new Date());
  const [rentals, statuses, t] = await Promise.all([
    listRentalsForReport(),
    listAllContainerStatuses(),
    getTranslations('reports'),
  ]);

  const report = buildStorageReport(rentals, window);
  const occupancy = summariseOccupancy(statuses);

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('storage.title')}</h1>
          <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
            {t('rangeWindow', {
              start: formatDate(window.startIso),
              end: formatDate(window.endIso),
            })}
          </p>
        </div>
        <nav className="flex gap-2 text-sm">
          {VALID_RANGES.map((r) => (
            <Link
              key={r}
              href={`/dashboard/reports/storage?range=${r}`}
              className={`rounded-md border px-3 py-1.5 ${
                r === range
                  ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
                  : 'hover:bg-[var(--color-muted)]'
              }`}
            >
              {t(`range.${r}` as never)}
            </Link>
          ))}
          <Link
            href="/dashboard/reports"
            className="rounded-md border px-3 py-1.5 hover:bg-[var(--color-muted)]"
          >
            {t('backToReports')}
          </Link>
        </nav>
      </header>

      <section className="grid gap-3 sm:grid-cols-4">
        <Tile label={t('storage.mrr')} value={formatPence(report.mrrPence)} />
        <Tile
          label={t('storage.activeRentals')}
          value={String(report.activeRentals)}
          hint={t('storage.pendingHint', { count: report.pendingRentals })}
        />
        <Tile label={t('storage.avgRate')} value={formatPence(report.avgRatePence)} />
        <Tile label={t('storage.occupancy')} value={`${occupancy.occupancyPct}%`} />
      </section>

      <section className="rounded-md border">
        <header className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
            {t('storage.movementHeading')}
          </h2>
        </header>
        <div className="grid gap-3 p-4 sm:grid-cols-4">
          <Stat
            label={t('storage.new')}
            value={String(report.newInPeriod)}
            sub={signedPence(report.newMrrPence)}
            tone="up"
          />
          <Stat
            label={t('storage.churned')}
            value={String(report.churnedInPeriod)}
            sub={signedPence(-report.churnedMrrPence)}
            tone="down"
          />
          <Stat
            label={t('storage.netMrr')}
            value={signedPence(report.netMrrChangePence)}
            tone={report.netMrrChangePence >= 0 ? 'up' : 'down'}
          />
          <Stat label={t('storage.churnRate')} value={fmtPct(report.churnRatePct)} />
        </div>
      </section>

      <section className="rounded-md border">
        <header className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
            {t('storage.occupancyHeading')}
          </h2>
        </header>
        <div className="grid gap-3 p-4 sm:grid-cols-5">
          <Stat label={t('storage.containers')} value={String(occupancy.total)} />
          <Stat label={t('storage.occupied')} value={String(occupancy.occupied)} />
          <Stat label={t('storage.reserved')} value={String(occupancy.reserved)} />
          <Stat label={t('storage.available')} value={String(occupancy.available)} />
          <Stat label={t('storage.maintenance')} value={String(occupancy.maintenance)} />
        </div>
      </section>
    </main>
  );
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-md border p-4">
      <p className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">{hint}</p> : null}
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'up' | 'down';
}) {
  const toneClass = tone === 'up' ? 'text-green-700' : tone === 'down' ? 'text-red-700' : '';
  return (
    <div>
      <p className="text-xs text-[var(--color-muted-foreground)]">{label}</p>
      <p className={`text-xl font-semibold tabular-nums ${toneClass}`}>{value}</p>
      {sub ? <p className="text-xs text-[var(--color-muted-foreground)]">{sub}</p> : null}
    </div>
  );
}
