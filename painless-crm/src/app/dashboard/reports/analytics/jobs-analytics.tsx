import { BarChart } from '@/components/charts/bar';
import { CHART_COLORS, Donut } from '@/components/charts/donut';
import {
  type AnalyticsJobRow,
  bySource,
  byStatus,
  byType,
  projectedRevenue,
  quoteConversionByStaff,
} from '@/lib/reports/analytics';
import { formatPence } from '@/lib/utils/format';
import { getTranslations } from 'next-intl/server';

function humanize(key: string): string {
  return key
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export async function JobsAnalytics({ rows }: { rows: AnalyticsJobRow[] }) {
  const t = await getTranslations('analytics');

  const types = byType(rows);
  const statuses = byStatus(rows);
  const sources = bySource(rows);
  const staff = quoteConversionByStaff(rows);

  const won = rows.filter((r) => r.paid_at).length;
  const revenuePence = rows.reduce((s, r) => s + (r.paid_at ? (r.quote_total_pence ?? 0) : 0), 0);
  const projected = projectedRevenue(rows);

  const segments = types.map((c, i) => ({
    label: humanize(c.key),
    value: c.count,
    color: CHART_COLORS[i % CHART_COLORS.length] as string,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label={t('enquiries')} value={String(rows.length)} />
        <Tile label={t('won')} value={String(won)} />
        <Tile label={t('revenue')} value={formatPence(revenuePence)} />
        <Tile label={t('projected')} value={formatPence(projected)} hint={t('projectedHint')} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card title={t('byType')}>
          <div className="flex items-center gap-5">
            <Donut segments={segments} />
            <ul className="flex flex-col gap-1.5 text-xs">
              {segments.length === 0 ? (
                <li className="text-[var(--color-muted-foreground)]">—</li>
              ) : (
                segments.map((s) => (
                  <li key={s.label} className="flex items-center gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-sm"
                      style={{ backgroundColor: s.color }}
                    />
                    <span>{s.label}</span>
                    <span className="ml-auto tabular-nums text-[var(--color-muted-foreground)]">
                      {s.value}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </div>
        </Card>

        <Card title={t('byStatus')}>
          <BarChart data={statuses.map((c) => ({ label: humanize(c.key), value: c.count }))} />
        </Card>

        <Card title={t('bySource')}>
          <BarChart data={sources.map((c) => ({ label: humanize(c.key), value: c.count }))} />
        </Card>

        <Card title={t('staffConversion')}>
          {staff.length === 0 ? (
            <p className="text-sm text-[var(--color-muted-foreground)]">—</p>
          ) : (
            <BarChart
              data={staff.map((s) => ({
                label: s.name,
                value: s.conversionPct ?? 0,
              }))}
              formatValue={(v) => `${v.toFixed(0)}%`}
            />
          )}
        </Card>
      </div>
    </div>
  );
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-md border p-4">
      <p className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-[var(--color-muted-foreground)]">{hint}</p> : null}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-md border p-4">
      <h2 className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}
