import { StageBadge } from '@/components/domain/job/stage-badge';
import type { JobListRow } from '@/lib/queries/jobs';
import { customerDisplayName, formatDate, formatPence } from '@/lib/utils/format';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

export async function JobsTable({ rows }: { rows: JobListRow[] }) {
  const t = await getTranslations('jobs');

  if (rows.length === 0) {
    return (
      <p className="rounded-md border bg-[var(--color-muted)]/40 px-4 py-10 text-center text-sm text-[var(--color-muted-foreground)]">
        {t('emptyList')}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-left text-sm">
        <thead className="bg-[var(--color-muted)]">
          <tr>
            <th className="px-3 py-2 font-medium">{t('columns.number')}</th>
            <th className="px-3 py-2 font-medium">{t('columns.customer')}</th>
            <th className="px-3 py-2 font-medium">{t('columns.stage')}</th>
            <th className="px-3 py-2 font-medium">{t('columns.assigned')}</th>
            <th className="px-3 py-2 font-medium">{t('columns.moveDate')}</th>
            <th className="px-3 py-2 font-medium">{t('columns.value')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t hover:bg-[var(--color-muted)]/40">
              <td className="px-3 py-2 font-mono">
                <Link href={`/dashboard/jobs/${row.id}`} className="hover:underline">
                  {row.job_number}
                </Link>
              </td>
              <td className="px-3 py-2">
                {row.customer ? (
                  <Link
                    href={`/dashboard/customers/${row.customer.id}`}
                    className="hover:underline"
                  >
                    {customerDisplayName(row.customer)}
                  </Link>
                ) : (
                  '—'
                )}
              </td>
              <td className="px-3 py-2">
                <StageBadge stage={row.stage} />
              </td>
              <td className="px-3 py-2">{row.assigned_to?.full_name ?? '—'}</td>
              <td className="px-3 py-2">{formatDate(row.move_date)}</td>
              <td className="px-3 py-2">{formatPence(row.quote_total_pence)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
