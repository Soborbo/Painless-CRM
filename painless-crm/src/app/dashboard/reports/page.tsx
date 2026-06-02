import { requireRole } from '@/lib/auth/require-role';
import { type ProfitRange, resolveRange } from '@/lib/jobs/profit-dashboard';
import { listReportJobs } from '@/lib/queries/reports';
import { aggregateBySource, aggregateFunnel, reportTotals } from '@/lib/reports/funnel';
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

// acquisition_source is a free-form-ish key ('google_ads', 'unknown', …);
// humanise it for display rather than routing arbitrary values through i18n.
function humanizeSource(source: string): string {
  return source
    .split('_')
    .map((w) => (w ? w[0]?.toUpperCase() + w.slice(1) : w))
    .join(' ');
}

export default async function ReportsPage({ searchParams }: Props) {
  await requireRole(REPORT_ROLES);
  const { range: rangeParam } = await searchParams;
  const range = parseRange(rangeParam);
  const window = resolveRange(range, new Date());
  const [rows, t] = await Promise.all([listReportJobs(window), getTranslations('reports')]);

  const funnel = aggregateFunnel(rows);
  const sources = aggregateBySource(rows);
  const totals = reportTotals(rows);

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
        <nav className="flex gap-2 text-sm">
          {VALID_RANGES.map((r) => (
            <Link
              key={r}
              href={`/dashboard/reports?range=${r}`}
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
            href="/dashboard/reports/sources"
            className="rounded-md border px-3 py-1.5 hover:bg-[var(--color-muted)]"
          >
            {t('attribution.link')}
          </Link>
          <Link
            href="/dashboard/reports/financial"
            className="rounded-md border px-3 py-1.5 hover:bg-[var(--color-muted)]"
          >
            {t('financial.link')}
          </Link>
          <Link
            href="/dashboard/reports/storage"
            className="rounded-md border px-3 py-1.5 hover:bg-[var(--color-muted)]"
          >
            {t('storage.link')}
          </Link>
          <Link
            href="/dashboard/reports/team"
            className="rounded-md border px-3 py-1.5 hover:bg-[var(--color-muted)]"
          >
            {t('teamLink')}
          </Link>
        </nav>
      </header>

      <section className="grid gap-3 sm:grid-cols-4">
        <Tile label={t('totals.enquiries')} value={String(totals.enquiries)} />
        <Tile label={t('totals.quoted')} value={String(totals.quoted)} />
        <Tile label={t('totals.won')} value={String(totals.won)} />
        <Tile label={t('totals.conversion')} value={fmtPct(totals.conversionPct)} />
      </section>

      <section className="rounded-md border">
        <header className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
            {t('funnelHeading')}
          </h2>
        </header>
        {totals.enquiries === 0 ? (
          <p className="px-4 py-6 text-sm text-[var(--color-muted-foreground)]">{t('empty')}</p>
        ) : (
          <ul className="flex flex-col gap-3 p-4">
            {funnel.map((step) => (
              <li key={step.key} className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-medium">{t(`steps.${step.key}` as never)}</span>
                  <span className="tabular-nums">
                    {step.count}
                    <span className="ml-2 text-xs text-[var(--color-muted-foreground)]">
                      {fmtPct(step.ofTopPct)}
                      {step.ofPrevPct !== null
                        ? ` · ${t('ofPrev', { pct: fmtPct(step.ofPrevPct) })}`
                        : ''}
                    </span>
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[var(--color-muted)]">
                  <div
                    className="h-full rounded-full bg-[var(--color-primary)]"
                    style={{ width: `${step.ofTopPct ?? 0}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-md border">
        <header className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
            {t('sourceHeading')}
          </h2>
        </header>
        {sources.length === 0 ? (
          <p className="px-4 py-6 text-sm text-[var(--color-muted-foreground)]">{t('empty')}</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-muted)] text-left text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
              <tr>
                <th className="px-4 py-2">{t('cols.source')}</th>
                <th className="px-4 py-2 text-right">{t('cols.leads')}</th>
                <th className="px-4 py-2 text-right">{t('cols.quoted')}</th>
                <th className="px-4 py-2 text-right">{t('cols.won')}</th>
                <th className="px-4 py-2 text-right">{t('cols.conversion')}</th>
                <th className="px-4 py-2 text-right">{t('cols.revenue')}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {sources.map((s) => (
                <tr key={s.source}>
                  <td className="px-4 py-2">{humanizeSource(s.source)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{s.leads}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{s.quoted}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{s.won}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{fmtPct(s.conversionPct)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {formatPence(s.revenuePence)}
                  </td>
                </tr>
              ))}
            </tbody>
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
