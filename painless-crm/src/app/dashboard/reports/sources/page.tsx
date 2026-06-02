import { requireRole } from '@/lib/auth/require-role';
import { type ProfitRange, resolveRange } from '@/lib/jobs/profit-dashboard';
import { listAttributionJobs } from '@/lib/queries/reports';
import { buildSourceAttribution } from '@/lib/reports/attribution';
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

function humanizeSource(source: string): string {
  return source
    .split('_')
    .map((w) => (w ? w[0]?.toUpperCase() + w.slice(1) : w))
    .join(' ');
}

export default async function SourceAttributionPage({ searchParams }: Props) {
  await requireRole(REPORT_ROLES);
  const { range: rangeParam } = await searchParams;
  const range = parseRange(rangeParam);
  const window = resolveRange(range, new Date());
  const [rows, t] = await Promise.all([listAttributionJobs(window), getTranslations('reports')]);

  const sources = buildSourceAttribution(rows);

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('attribution.title')}</h1>
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
              href={`/dashboard/reports/sources?range=${r}`}
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
            href={`/dashboard/reports/sources/export?range=${range}`}
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

      <p className="text-sm text-[var(--color-muted-foreground)]">{t('attribution.intro')}</p>

      <section className="overflow-x-auto rounded-md border">
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
                <th className="px-4 py-2 text-right">{t('attribution.cols.avgValue')}</th>
                <th className="px-4 py-2 text-right">{t('attribution.cols.repeat')}</th>
                <th className="px-4 py-2 text-right">{t('attribution.cols.ltv')}</th>
                <th className="px-4 py-2 text-right">{t('attribution.cols.score')}</th>
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
                  <td className="px-4 py-2 text-right tabular-nums">
                    {formatPence(s.avgJobValuePence)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{fmtPct(s.repeatRatePct)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatPence(s.ltvPence)}</td>
                  <td className="px-4 py-2 text-right font-semibold tabular-nums">{s.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
