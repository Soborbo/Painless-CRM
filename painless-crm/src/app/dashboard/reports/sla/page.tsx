import { requireRole } from '@/lib/auth/require-role';
import { type ProfitRange, resolveRange } from '@/lib/jobs/profit-dashboard';
import { listSlaJobs } from '@/lib/queries/reports';
import { type SlaMetrics, buildSlaPerformance } from '@/lib/reports/sla-performance';
import { formatDate } from '@/lib/utils/format';
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

function fmtMins(mins: number | null): string {
  if (mins === null) return '—';
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function onTimePct(m: SlaMetrics): number | null {
  const decided = m.total - m.pending;
  return decided > 0 ? (m.onTime / decided) * 100 : null;
}

export default async function SlaReportPage({ searchParams }: Props) {
  await requireRole(REPORT_ROLES);
  const { range: rangeParam } = await searchParams;
  const range = parseRange(rangeParam);
  const window = resolveRange(range, new Date());
  const [rows, t] = await Promise.all([listSlaJobs(window), getTranslations('reports')]);

  const { overall, byRep } = buildSlaPerformance(rows, new Date());

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('sla.title')}</h1>
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
              href={`/dashboard/reports/sla?range=${r}`}
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
        <Tile label={t('sla.leads')} value={String(overall.total)} />
        <Tile label={t('sla.onTime')} value={fmtPct(onTimePct(overall))} />
        <Tile label={t('sla.breachRate')} value={fmtPct(overall.breachPct)} tone="danger" />
        <Tile label={t('sla.avgResponse')} value={fmtMins(overall.avgResponseMins)} />
      </section>

      <section className="overflow-x-auto rounded-md border">
        <header className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
            {t('sla.leaderboard')}
          </h2>
        </header>
        {byRep.length === 0 ? (
          <p className="px-4 py-6 text-sm text-[var(--color-muted-foreground)]">{t('empty')}</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-muted)] text-left text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
              <tr>
                <th className="px-4 py-2">{t('sla.cols.rep')}</th>
                <th className="px-4 py-2 text-right">{t('sla.cols.leads')}</th>
                <th className="px-4 py-2 text-right">{t('sla.cols.onTime')}</th>
                <th className="px-4 py-2 text-right">{t('sla.cols.breached')}</th>
                <th className="px-4 py-2 text-right">{t('sla.cols.pending')}</th>
                <th className="px-4 py-2 text-right">{t('sla.cols.avgResponse')}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {byRep.map((rep) => (
                <tr key={rep.repId}>
                  <td className="px-4 py-2">{rep.repName}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{rep.total}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{fmtPct(onTimePct(rep))}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{rep.breached}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{rep.pending}</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {fmtMins(rep.avgResponseMins)}
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

function Tile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'danger';
}) {
  return (
    <div className="rounded-md border p-4">
      <p className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
        {label}
      </p>
      <p
        className={`mt-2 text-2xl font-semibold tabular-nums ${
          tone === 'danger' && value !== '—' && value !== '0.0%' ? 'text-red-700' : ''
        }`}
      >
        {value}
      </p>
    </div>
  );
}
