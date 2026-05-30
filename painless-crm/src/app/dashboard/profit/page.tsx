import { requireRole } from '@/lib/auth/require-role';
import { computeProfit } from '@/lib/jobs/profit';
import { type ProfitRange, aggregateProfit, resolveRange } from '@/lib/jobs/profit-dashboard';
import { listProfitDashboardJobs } from '@/lib/queries/profit-dashboard';
import { customerDisplayName, formatDate, formatPence } from '@/lib/utils/format';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

const REVIEW_ROLES = ['manager', 'admin', 'super_admin'] as const;
const VALID_RANGES = ['month', 'quarter'] as const satisfies readonly ProfitRange[];

export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<{ range?: string }> };

function parseRange(value: string | undefined): ProfitRange {
  return (VALID_RANGES as readonly string[]).includes(value ?? '')
    ? (value as ProfitRange)
    : 'month';
}

export default async function ProfitDashboardPage({ searchParams }: Props) {
  await requireRole(REVIEW_ROLES);
  const { range: rangeParam } = await searchParams;
  const range = parseRange(rangeParam);
  const now = new Date();
  const window = resolveRange(range, now);
  const [rows, t] = await Promise.all([
    listProfitDashboardJobs(window),
    getTranslations('profitDashboard'),
  ]);
  const totals = aggregateProfit(rows);

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
            {t('rangeWindow', {
              start: formatDate(window.startIso),
              end: formatDate(window.endIso),
            })}
          </p>
        </div>
        <nav className="flex items-center gap-2 text-sm">
          {VALID_RANGES.map((r) => (
            <Link
              key={r}
              href={`/dashboard/profit?range=${r}`}
              className={`rounded-md border px-3 py-1.5 ${
                r === range
                  ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
                  : 'hover:bg-[var(--color-muted)]'
              }`}
            >
              {t(`range.${r}` as never)}
            </Link>
          ))}
          <a
            href={`/dashboard/profit/export?range=${range}`}
            className="rounded-md border px-3 py-1.5 hover:bg-[var(--color-muted)]"
          >
            {t('exportCsv')}
          </a>
        </nav>
      </header>

      <section className="grid gap-3 sm:grid-cols-4">
        <Tile label={t('revenue')} value={formatPence(totals.revenuePence)} />
        <Tile label={t('cost')} value={formatPence(totals.costPence)} />
        <Tile
          label={t('profit')}
          value={formatPence(totals.profitPence)}
          tone={totals.profitPence < 0 ? 'danger' : 'success'}
        />
        <Tile
          label={t('margin')}
          value={totals.marginPct === null ? '—' : `${totals.marginPct.toFixed(1)}%`}
          tone={totals.marginPct === null ? 'muted' : totals.marginPct < 0 ? 'danger' : 'success'}
        />
      </section>

      {totals.pendingReviewCount > 0 ? (
        <div className="flex items-center justify-between rounded-md border bg-[var(--color-muted)] px-4 py-3 text-sm">
          <span>{t('pendingReview', { count: totals.pendingReviewCount })}</span>
        </div>
      ) : null}

      <section className="rounded-md border">
        <header className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
            {t('jobsHeading', { count: totals.jobCount })}
          </h2>
        </header>
        {rows.length === 0 ? (
          <p className="px-4 py-6 text-sm text-[var(--color-muted-foreground)]">{t('empty')}</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-muted)] text-left text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
              <tr>
                <th className="px-4 py-2">{t('cols.job')}</th>
                <th className="px-4 py-2">{t('cols.customer')}</th>
                <th className="px-4 py-2">{t('cols.completed')}</th>
                <th className="px-4 py-2 text-right">{t('cols.revenue')}</th>
                <th className="px-4 py-2 text-right">{t('cols.cost')}</th>
                <th className="px-4 py-2 text-right">{t('cols.profit')}</th>
                <th className="px-4 py-2 text-right">{t('cols.margin')}</th>
                <th className="px-4 py-2">{t('cols.status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row) => {
                const r = computeProfit({
                  revenuePence: row.revenuePence,
                  crewPence: row.actual_crew_cost_pence ?? 0,
                  vanPence: row.actual_van_cost_pence ?? 0,
                  passthroughPence: row.passthrough_costs_pence ?? 0,
                });
                return (
                  <tr key={row.id}>
                    <td className="px-4 py-2 font-mono">
                      <Link
                        href={`/dashboard/jobs/${row.id}/profit-review`}
                        className="hover:underline"
                      >
                        {row.job_number}
                      </Link>
                    </td>
                    <td className="px-4 py-2">
                      {row.customer ? customerDisplayName(row.customer) : '—'}
                    </td>
                    <td className="px-4 py-2">{formatDate(row.completed_at)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {formatPence(row.revenuePence)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {formatPence(r.totalCostPence)}
                    </td>
                    <td
                      className={`px-4 py-2 text-right tabular-nums ${
                        r.profitPence < 0 ? 'text-red-700' : ''
                      }`}
                    >
                      {formatPence(r.profitPence)}
                    </td>
                    <td
                      className={`px-4 py-2 text-right tabular-nums ${
                        r.marginPct !== null && r.marginPct < 0 ? 'text-red-700' : ''
                      }`}
                    >
                      {r.marginPct === null ? '—' : `${r.marginPct.toFixed(1)}%`}
                    </td>
                    <td className="px-4 py-2 text-xs text-[var(--color-muted-foreground)]">
                      {t(`status.${row.profit_review_status}` as never)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}

function Tile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'success' | 'danger' | 'muted';
}) {
  const cls =
    tone === 'danger'
      ? 'text-red-700'
      : tone === 'success'
        ? 'text-emerald-700'
        : 'text-[var(--color-foreground)]';
  return (
    <div className="rounded-md border p-4">
      <p className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
        {label}
      </p>
      <p className={`mt-2 text-2xl font-semibold tabular-nums ${cls}`}>{value}</p>
    </div>
  );
}
