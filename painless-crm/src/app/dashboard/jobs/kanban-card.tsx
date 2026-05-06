import { SLABadge, SLA_BORDER_CLASS } from '@/components/domain/job/sla-badge';
import { TagChip } from '@/components/domain/job/tag-chip';
import { computeSLAStatus } from '@/lib/jobs/sla';
import type { JobListRow } from '@/lib/queries/jobs';
import { customerDisplayName, formatDate, formatPence } from '@/lib/utils/format';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { QuickStageMenu } from './quick-stage-menu';

export async function KanbanCard({ row }: { row: JobListRow }) {
  const t = await getTranslations('jobs');
  const sla = computeSLAStatus({
    firstResponseDueAt: row.first_response_due_at,
    firstResponseAt: row.first_response_at,
    enquiryAt: row.enquiry_at,
  });

  return (
    <article
      className={`group flex flex-col gap-2 rounded-md border bg-[var(--color-background)] p-3 text-sm shadow-sm hover:shadow ${SLA_BORDER_CLASS[sla]}`}
    >
      <header className="flex items-baseline justify-between gap-2">
        <Link href={`/dashboard/jobs/${row.id}`} className="font-mono text-xs hover:underline">
          {row.job_number}
        </Link>
        <SLABadge status={sla} />
      </header>
      <div className="flex flex-col">
        <span className="truncate font-medium">
          {row.customer ? customerDisplayName(row.customer) : '—'}
        </span>
        {row.move_date ? (
          <span className="text-xs text-[var(--color-muted-foreground)]">
            {t('moveDate')}: {formatDate(row.move_date)}
          </span>
        ) : null}
        {row.quote_total_pence !== null ? (
          <span className="flex items-center gap-1.5 text-xs text-[var(--color-muted-foreground)]">
            {formatPence(row.quote_total_pence)}
            {row.accepted_at ? (
              <span
                className="rounded-md bg-green-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-green-800"
                title={t('contractTooltip')}
              >
                {t('contract')}
              </span>
            ) : null}
          </span>
        ) : null}
      </div>
      {row.tags.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {row.tags.map((tag) => (
            <TagChip key={tag} tag={tag} />
          ))}
        </div>
      ) : null}
      <footer className="flex items-center justify-between text-xs text-[var(--color-muted-foreground)]">
        <span className="truncate">{row.assigned_to?.full_name ?? t('unassigned')}</span>
        <QuickStageMenu id={row.id} version={row.version} stage={row.stage} />
      </footer>
    </article>
  );
}
