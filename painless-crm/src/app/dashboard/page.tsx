import { requireUser } from '@/lib/auth/require-role';
import { KpiTiles } from '@/components/domain/KpiTiles';
import { getKpiCounts } from '@/lib/queries/kpi';
import { type TodayMoveRow, getHomeSnapshot } from '@/lib/queries/home-snapshot';
import { type KpiPeriod, buildKpiMetrics, isKpiPeriod, kpiWindows } from '@/lib/reports/kpi';
import { customerDisplayName, formatDate, formatDateTime, formatPence } from '@/lib/utils/format';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<{ period?: string }> };

export default async function DashboardPage({ searchParams }: Props) {
  const profile = await requireUser();
  const now = new Date();
  const { period: periodParam } = await searchParams;
  const period: KpiPeriod = isKpiPeriod(periodParam) ? periodParam : 'week';
  const windows = kpiWindows(now, period);
  const [snapshot, kpiCurrent, kpiPrevious, t] = await Promise.all([
    getHomeSnapshot(now),
    getKpiCounts(windows.current),
    getKpiCounts(windows.previous),
    getTranslations('dashboard'),
  ]);
  const kpiMetrics = buildKpiMetrics(kpiCurrent, kpiPrevious);

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t('today', { date: formatDate(now) })}
        </h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          {t('signedInAs', { name: profile.full_name, role: profile.role })}
        </p>
      </header>

      <KpiTiles metrics={kpiMetrics} period={period} />

      <section className="grid gap-3 sm:grid-cols-3">
        <Tile label={t('newLeads')} value={snapshot.newLeadsCount} hint={t('last24h')} />
        <Tile label={t('quotesSent')} value={snapshot.quotesSentCount} hint={t('last24h')} />
        <Tile
          label={t('quotesAccepted')}
          value={snapshot.quotesAcceptedCount}
          hint={t('last24h')}
        />
      </section>

      {snapshot.slaOverdueCount > 0 ? (
        <Banner
          tone="danger"
          message={t('slaOverdue', { count: snapshot.slaOverdueCount })}
          ctaHref="/dashboard/sla"
          ctaLabel={t('view')}
        />
      ) : null}

      {snapshot.callbacksDueToday > 0 ? (
        <Banner
          tone="muted"
          message={t('callbacksDueToday', { count: snapshot.callbacksDueToday })}
          ctaHref="/dashboard/callbacks"
          ctaLabel={t('view')}
        />
      ) : null}

      <TodaysMovesSection rows={snapshot.todaysMoves} t={t} />

      <CashSection cash={snapshot.cash} t={t} />

      {snapshot.profitReviewPending > 0 ? (
        <Banner
          tone="muted"
          message={t('profitReviewPending', { count: snapshot.profitReviewPending })}
          ctaHref="/dashboard/profit/review"
          ctaLabel={t('view')}
        />
      ) : null}
    </main>
  );
}

function Tile({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="rounded-md border p-4">
      <p className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">{hint}</p>
    </div>
  );
}

function Banner({
  tone,
  message,
  ctaHref,
  ctaLabel,
}: {
  tone: 'danger' | 'muted';
  message: string;
  ctaHref: string;
  ctaLabel: string;
}) {
  const palette =
    tone === 'danger'
      ? 'border-red-200 bg-red-50 text-red-800'
      : 'border-[var(--color-border)] bg-[var(--color-muted)] text-[var(--color-foreground)]';
  return (
    <div
      className={`flex items-center justify-between rounded-md border px-4 py-3 text-sm ${palette}`}
    >
      <span>{message}</span>
      <Link href={ctaHref} className="font-medium hover:underline">
        {ctaLabel} →
      </Link>
    </div>
  );
}

async function TodaysMovesSection({
  rows,
  t,
}: {
  rows: TodayMoveRow[];
  t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  return (
    <section className="rounded-md border p-4">
      <header className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
          {t('todaysMoves', { count: rows.length })}
        </h2>
        <Link href="/dashboard/jobs" className="text-xs hover:underline">
          {t('viewAll')} →
        </Link>
      </header>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--color-muted-foreground)]">{t('noMovesToday')}</p>
      ) : (
        <ul className="mt-3 flex flex-col divide-y">
          {rows.map((row) => (
            <li key={row.id} className="flex items-baseline justify-between gap-3 py-2 text-sm">
              <span className="font-mono text-xs text-[var(--color-muted-foreground)]">
                {formatDateTime(row.move_date)}
              </span>
              <span className="flex-1 truncate">
                {row.customer ? customerDisplayName(row.customer) : '—'}
              </span>
              <Link
                href={`/dashboard/jobs/${row.id}`}
                className="font-mono text-xs hover:underline"
              >
                {row.job_number}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CashSection({
  cash,
  t,
}: {
  cash: {
    outstandingPence: number;
    overduePence: number;
    outstandingCount: number;
    overdueCount: number;
  };
  t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  return (
    <section className="rounded-md border p-4">
      <header className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
          {t('cash')}
        </h2>
      </header>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-xs text-[var(--color-muted-foreground)]">{t('outstanding')}</p>
          <p className="text-2xl font-semibold tabular-nums">
            {formatPence(cash.outstandingPence)}
          </p>
          <p className="text-xs text-[var(--color-muted-foreground)]">
            {t('invoices', { count: cash.outstandingCount })}
          </p>
        </div>
        <div>
          <p className="text-xs text-[var(--color-muted-foreground)]">{t('overdue')}</p>
          <p
            className={`text-2xl font-semibold tabular-nums ${cash.overduePence > 0 ? 'text-red-700' : ''}`}
          >
            {formatPence(cash.overduePence)}
          </p>
          <p className="text-xs text-[var(--color-muted-foreground)]">
            {t('invoices', { count: cash.overdueCount })}
          </p>
        </div>
      </div>
    </section>
  );
}
