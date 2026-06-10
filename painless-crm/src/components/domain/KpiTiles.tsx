import { KPI_PERIODS, type KpiMetric, type KpiPeriod } from '@/lib/reports/kpi';
import { formatPence } from '@/lib/utils/format';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

// Phase 14 — owner home KPI strip: current-period figures with a delta vs the
// previous equal window. Pure presentation; the metrics + windows come from
// lib/reports/kpi. Server component so it can resolve its own translations.

function formatValue(metric: KpiMetric): string {
  return metric.isMoney ? formatPence(metric.current) : String(metric.current);
}

function DeltaChip({
  metric,
  vsLabel,
}: {
  metric: KpiMetric;
  vsLabel: string;
}) {
  const tone =
    metric.direction === 'up'
      ? 'text-green-700'
      : metric.direction === 'down'
        ? 'text-red-700'
        : 'text-[var(--color-muted-foreground)]';
  const arrow = metric.direction === 'up' ? '↑' : metric.direction === 'down' ? '↓' : '→';
  const value = metric.deltaPct === null ? '—' : `${Math.abs(metric.deltaPct).toFixed(0)}%`;
  return (
    <p className={`mt-1 text-xs ${tone}`}>
      {arrow} {value} <span className="text-[var(--color-muted-foreground)]">{vsLabel}</span>
    </p>
  );
}

export async function KpiTiles({
  metrics,
  period,
}: {
  metrics: KpiMetric[];
  period: KpiPeriod;
}) {
  const t = await getTranslations('dashboard.kpi');
  const vsLabel = t(`vs.${period}` as never);

  return (
    <section className="flex flex-col gap-3">
      <header className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
          {t('heading')}
        </h2>
        <nav className="flex gap-1.5 text-xs">
          {KPI_PERIODS.map((p) => (
            <Link
              key={p}
              href={`/dashboard?period=${p}`}
              className={`rounded-md border px-2.5 py-1 ${
                p === period
                  ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
                  : 'hover:bg-[var(--color-muted)]'
              }`}
            >
              {t(`period.${p}` as never)}
            </Link>
          ))}
        </nav>
      </header>
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {metrics.map((metric) => (
          <div key={metric.key} className="rounded-md border p-4">
            <p className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
              {t(`metric.${metric.key}` as never)}
            </p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{formatValue(metric)}</p>
            <DeltaChip metric={metric} vsLabel={vsLabel} />
          </div>
        ))}
      </div>
    </section>
  );
}
