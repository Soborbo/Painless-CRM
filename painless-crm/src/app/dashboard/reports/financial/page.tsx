import { requireRole } from '@/lib/auth/require-role';
import { type ProfitRange, resolveRange } from '@/lib/jobs/profit-dashboard';
import { listFinancialInvoices, listOutstandingInvoices } from '@/lib/queries/reports';
import { AGING_BUCKETS, buildArAging, buildRevenueSummary } from '@/lib/reports/financial';
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

export default async function FinancialReportPage({ searchParams }: Props) {
  await requireRole(REPORT_ROLES);
  const { range: rangeParam } = await searchParams;
  const range = parseRange(rangeParam);
  const now = new Date();
  const window = resolveRange(range, now);
  const [cohort, outstanding, t] = await Promise.all([
    listFinancialInvoices(window),
    listOutstandingInvoices(),
    getTranslations('reports'),
  ]);

  const summary = buildRevenueSummary(cohort);
  const aging = buildArAging(outstanding, now.toISOString());
  const pctOfTotal = (pence: number): number | null =>
    aging.totalOutstandingPence > 0 ? (pence / aging.totalOutstandingPence) * 100 : null;

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('financial.title')}</h1>
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
              href={`/dashboard/reports/financial?range=${r}`}
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
            href="/dashboard/reports/financial/export"
            className="rounded-md border px-3 py-1.5 hover:bg-[var(--color-muted)]"
          >
            {t('exportCsv')}
          </a>
          <Link
            href="/dashboard/reports"
            className="rounded-md border px-3 py-1.5 hover:bg-[var(--color-muted)]"
          >
            {t('backToReports')}
          </Link>
        </nav>
      </header>

      <section className="grid gap-3 sm:grid-cols-4">
        <Tile label={t('financial.invoiced')} value={formatPence(summary.invoicedPence)} />
        <Tile label={t('financial.collected')} value={formatPence(summary.collectedPence)} />
        <Tile label={t('financial.outstanding')} value={formatPence(summary.outstandingPence)} />
        <Tile label={t('financial.collectionRate')} value={fmtPct(summary.collectionRatePct)} />
      </section>

      <section className="overflow-x-auto rounded-md border">
        <header className="flex items-baseline justify-between border-b px-4 py-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
            {t('financial.agingHeading')}
          </h2>
          <span className="text-xs text-[var(--color-muted-foreground)]">
            {t('financial.asOf', { date: formatDate(now.toISOString()) })}
          </span>
        </header>
        {aging.totalCount === 0 ? (
          <p className="px-4 py-6 text-sm text-[var(--color-muted-foreground)]">
            {t('financial.noOutstanding')}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-muted)] text-left text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
              <tr>
                <th className="px-4 py-2">{t('financial.cols.bucket')}</th>
                <th className="px-4 py-2 text-right">{t('financial.cols.count')}</th>
                <th className="px-4 py-2 text-right">{t('financial.cols.outstanding')}</th>
                <th className="px-4 py-2 text-right">{t('financial.cols.share')}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {aging.buckets.map((b) => (
                <tr
                  key={b.key}
                  className={b.key === 'd90_plus' && b.count > 0 ? 'text-red-700' : ''}
                >
                  <td className="px-4 py-2">{t(`financial.buckets.${b.key}` as never)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{b.count}</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {formatPence(b.outstandingPence)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {fmtPct(pctOfTotal(b.outstandingPence))}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t bg-[var(--color-muted)] font-semibold">
              <tr>
                <td className="px-4 py-2">{t('financial.cols.total')}</td>
                <td className="px-4 py-2 text-right tabular-nums">{aging.totalCount}</td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {formatPence(aging.totalOutstandingPence)}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">—</td>
              </tr>
            </tfoot>
          </table>
        )}
      </section>
    </main>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-4">
      <p className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
