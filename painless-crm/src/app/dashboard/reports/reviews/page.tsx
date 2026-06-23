import { requireRole } from '@/lib/auth/require-role';
import { type ProfitRange, resolveRange } from '@/lib/jobs/profit-dashboard';
import { listReviewRequests } from '@/lib/queries/reports';
import { buildReviewFunnel } from '@/lib/reports/review-funnel';
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

function widthPct(count: number, top: number): number {
  return top > 0 ? Math.min(100, (count / top) * 100) : 0;
}

export default async function ReviewFunnelPage({ searchParams }: Props) {
  await requireRole(REPORT_ROLES);
  const { range: rangeParam } = await searchParams;
  const range = parseRange(rangeParam);
  const window = resolveRange(range, new Date());
  const [rows, t] = await Promise.all([listReviewRequests(window), getTranslations('reports')]);

  const f = buildReviewFunnel(rows);
  const rateOfSent = (n: number): number | null => (f.sent > 0 ? (n / f.sent) * 100 : null);

  const steps = [
    { key: 'requests', count: f.requests },
    { key: 'sent', count: f.sent },
    { key: 'clicked', count: f.clicked },
    { key: 'reviewed', count: f.reviewed },
  ] as const;

  const outcomes = [
    { key: 'reviewed', count: f.reviewed, rate: rateOfSent(f.reviewed) },
    { key: 'complained', count: f.complained, rate: rateOfSent(f.complained) },
    { key: 'unsubscribed', count: f.unsubscribed, rate: rateOfSent(f.unsubscribed) },
    { key: 'exhausted', count: f.exhausted, rate: rateOfSent(f.exhausted) },
    { key: 'inFlight', count: f.inFlight, rate: null },
  ] as const;

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('reviews.title')}</h1>
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
              href={`/dashboard/reports/reviews?range=${r}`}
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
        <Tile label={t('reviews.requests')} value={String(f.requests)} />
        <Tile label={t('reviews.sent')} value={String(f.sent)} />
        <Tile label={t('reviews.reviews')} value={String(f.reviewed)} />
        <Tile label={t('reviews.reviewRate')} value={fmtPct(f.reviewRatePct)} />
      </section>

      <section className="rounded-md border">
        <header className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
            {t('reviews.funnelHeading')}
          </h2>
        </header>
        {f.requests === 0 ? (
          <p className="px-4 py-6 text-sm text-[var(--color-muted-foreground)]">
            {t('reviews.empty')}
          </p>
        ) : (
          <ul className="flex flex-col gap-3 p-4">
            {steps.map((step) => (
              <li key={step.key} className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-medium">{t(`reviews.steps.${step.key}` as never)}</span>
                  <span className="tabular-nums">
                    {step.count}
                    <span className="ml-2 text-xs text-[var(--color-muted-foreground)]">
                      {fmtPct(widthPct(step.count, f.requests))}
                    </span>
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[var(--color-muted)]">
                  <div
                    className="h-full rounded-full bg-[var(--color-primary)]"
                    style={{ width: `${widthPct(step.count, f.requests)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="overflow-x-auto rounded-md border">
        <header className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
            {t('reviews.outcomesHeading')}
          </h2>
        </header>
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-muted)] text-left text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
            <tr>
              <th className="px-4 py-2">{t('reviews.cols.outcome')}</th>
              <th className="px-4 py-2 text-right">{t('reviews.cols.count')}</th>
              <th className="px-4 py-2 text-right">{t('reviews.cols.rate')}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {outcomes.map((o) => (
              <tr key={o.key}>
                <td className="px-4 py-2">{t(`reviews.outcomes.${o.key}` as never)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{o.count}</td>
                <td className="px-4 py-2 text-right tabular-nums">{fmtPct(o.rate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
