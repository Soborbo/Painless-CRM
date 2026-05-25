import { ProfitReviewForm } from '@/components/domain/job/profit-review-form';
import { requireRole } from '@/lib/auth/require-role';
import { canFinaliseProfitReview, computeProfit, isProfitReviewStage } from '@/lib/jobs/profit';
import { getProfitReviewSnapshot } from '@/lib/queries/profit-review';
import { formatDateTime, formatPence } from '@/lib/utils/format';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';

const REVIEW_ROLES = ['manager', 'admin', 'super_admin'] as const;

type Props = { params: Promise<{ id: string }> };

export default async function ProfitReviewPage({ params }: Props) {
  const { id } = await params;
  const me = await requireRole(REVIEW_ROLES);
  const snapshot = await getProfitReviewSnapshot(id);
  if (!snapshot) notFound();
  const t = await getTranslations('profitReview');

  const { job, revenuePence, invoiceCount } = snapshot;
  const stageEligible = isProfitReviewStage(job.stage);
  const result = computeProfit({
    revenuePence,
    crewPence: job.actual_crew_cost_pence ?? 0,
    vanPence: job.actual_van_cost_pence ?? 0,
    passthroughPence: job.passthrough_costs_pence ?? 0,
  });
  const canFinalise = canFinaliseProfitReview(job.profit_review_status, me.role);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10">
      <nav className="text-sm text-[var(--color-muted-foreground)]">
        <Link href={`/dashboard/jobs/${id}`} className="hover:underline">
          {job.job_number}
        </Link>
        <span className="mx-1.5">/</span>
        <span>{t('title')}</span>
      </nav>

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('heading')}</h1>
          <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
            {t(`statusLabel.${job.profit_review_status}` as never)}
            {job.profit_review_completed_at ? (
              <>
                {' · '}
                {t('completedBy', {
                  who: job.profit_review_completed_by?.full_name ?? '—',
                  when: formatDateTime(job.profit_review_completed_at),
                })}
              </>
            ) : null}
          </p>
        </div>
      </header>

      {!stageEligible ? (
        <p className="rounded-md border bg-[var(--color-muted)] p-4 text-sm">{t('wrongStage')}</p>
      ) : null}

      <section className="rounded-md border p-4">
        <h2 className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
          {t('summary')}
        </h2>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <Stat
            label={t('revenue')}
            value={formatPence(revenuePence)}
            hint={t('invoices', { count: invoiceCount })}
          />
          <Stat label={t('cost')} value={formatPence(result.totalCostPence)} />
          <Stat
            label={t('profit')}
            value={formatPence(result.profitPence)}
            tone={result.profitPence < 0 ? 'danger' : 'success'}
          />
          <Stat
            label={t('margin')}
            value={result.marginPct === null ? '—' : `${result.marginPct.toFixed(1)}%`}
            tone={result.marginPct === null ? 'muted' : result.marginPct < 0 ? 'danger' : 'success'}
          />
        </dl>
      </section>

      {stageEligible ? (
        <section className="rounded-md border p-4">
          <h2 className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
            {t('costsHeading')}
          </h2>
          <div className="mt-3">
            <ProfitReviewForm
              jobId={job.id}
              version={job.version}
              status={job.profit_review_status}
              canFinalise={canFinalise}
              defaults={{
                actual_crew_cost_pence: job.actual_crew_cost_pence ?? 0,
                actual_van_cost_pence: job.actual_van_cost_pence ?? 0,
                passthrough_costs_pence: job.passthrough_costs_pence ?? 0,
              }}
            />
          </div>
        </section>
      ) : null}
    </main>
  );
}

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'success' | 'danger' | 'muted';
}) {
  const cls =
    tone === 'danger'
      ? 'text-red-700'
      : tone === 'success'
        ? 'text-emerald-700'
        : 'text-[var(--color-foreground)]';
  return (
    <div>
      <p className="text-xs text-[var(--color-muted-foreground)]">{label}</p>
      <p className={`text-lg font-semibold tabular-nums ${cls}`}>{value}</p>
      {hint ? <p className="text-xs text-[var(--color-muted-foreground)]">{hint}</p> : null}
    </div>
  );
}
