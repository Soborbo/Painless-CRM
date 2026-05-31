import { requireRole } from '@/lib/auth/require-role';
import {
  type ReviewQueueRow,
  listJobsAwaitingProfitReview,
} from '@/lib/queries/profit-review-queue';
import { customerDisplayName, formatDate } from '@/lib/utils/format';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

const REVIEW_ROLES = ['manager', 'admin', 'super_admin'] as const;

export const dynamic = 'force-dynamic';

export default async function ProfitReviewQueuePage() {
  await requireRole(REVIEW_ROLES);
  const [rows, t, tj] = await Promise.all([
    listJobsAwaitingProfitReview(),
    getTranslations('profitReview'),
    getTranslations('jobs'),
  ]);

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-10">
      <nav className="text-sm text-[var(--color-muted-foreground)]">
        <Link href="/dashboard/profit" className="hover:underline">
          {t('queue.dashboardLink')}
        </Link>
        <span className="mx-1.5">/</span>
        <span>{t('queue.title')}</span>
      </nav>

      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t('queue.title')}</h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{t('queue.subtitle')}</p>
      </header>

      {rows.length === 0 ? (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-[var(--color-muted-foreground)]">
          {t('queue.empty')}
        </p>
      ) : (
        <section className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-[var(--color-muted-foreground)]">
              <tr>
                <th className="px-4 py-2">{t('queue.cols.job')}</th>
                <th className="px-4 py-2">{t('queue.cols.customer')}</th>
                <th className="px-4 py-2">{t('queue.cols.completed')}</th>
                <th className="px-4 py-2">{t('queue.cols.stage')}</th>
                <th className="px-4 py-2">{t('queue.cols.assigned')}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row) => (
                <ReviewRow key={row.id} row={row} tj={tj} />
              ))}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}

function ReviewRow({
  row,
  tj,
}: {
  row: ReviewQueueRow;
  tj: Awaited<ReturnType<typeof getTranslations<'jobs'>>>;
}) {
  return (
    <tr>
      <td className="px-4 py-2">
        <Link
          href={`/dashboard/jobs/${row.id}/profit-review`}
          className="font-mono hover:underline"
        >
          {row.job_number}
        </Link>
      </td>
      <td className="px-4 py-2">{row.customer ? customerDisplayName(row.customer) : '—'}</td>
      <td className="px-4 py-2 whitespace-nowrap">
        {row.completed_at ? formatDate(row.completed_at) : '—'}
      </td>
      <td className="px-4 py-2 text-[var(--color-muted-foreground)]">
        {tj(`stages.${row.stage}` as never)}
      </td>
      <td className="px-4 py-2">{row.assigned_to_name ?? '—'}</td>
    </tr>
  );
}
