import { SLABadge } from '@/components/domain/job/sla-badge';
import { StageBadge } from '@/components/domain/job/stage-badge';
import { TagChip } from '@/components/domain/job/tag-chip';
import { SortableHeader } from '@/components/ui/sortable-header';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { computeSLAStatus } from '@/lib/jobs/sla';
import type { JobListRow } from '@/lib/queries/jobs';
import { customerDisplayName, formatDate, formatPence } from '@/lib/utils/format';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

export async function JobsTable({
  rows,
  sort,
  dir,
  params,
}: {
  rows: JobListRow[];
  sort?: string;
  dir?: 'asc' | 'desc';
  params?: Record<string, string | undefined>;
}) {
  const t = await getTranslations('jobs');

  if (rows.length === 0) {
    return (
      <p className="rounded-md border bg-[var(--color-muted)]/40 px-4 py-10 text-center text-sm text-[var(--color-muted-foreground)]">
        {t('emptyList')}
      </p>
    );
  }

  const sortProps = { sort, dir, params };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader className="bg-[var(--color-muted)]">
          <TableRow>
            <TableHead>
              <SortableHeader label={t('columns.number')} column="job_number" {...sortProps} />
            </TableHead>
            <TableHead>{t('columns.customer')}</TableHead>
            <TableHead>
              <SortableHeader label={t('columns.stage')} column="stage" {...sortProps} />
            </TableHead>
            <TableHead>{t('columns.assigned')}</TableHead>
            <TableHead>
              <SortableHeader label={t('columns.moveDate')} column="move_date" {...sortProps} />
            </TableHead>
            <TableHead>
              <SortableHeader
                label={t('columns.value')}
                column="quote_total_pence"
                {...sortProps}
              />
            </TableHead>
            <TableHead>{t('columns.tags')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const sla = computeSLAStatus({
              firstResponseDueAt: row.first_response_due_at,
              firstResponseAt: row.first_response_at,
              enquiryAt: row.enquiry_at,
            });
            return (
              <TableRow key={row.id}>
                <TableCell className="font-mono">
                  <div className="flex items-center gap-2">
                    <Link href={`/dashboard/jobs/${row.id}`} className="hover:underline">
                      {row.job_number}
                    </Link>
                    <SLABadge status={sla} />
                  </div>
                </TableCell>
                <TableCell>
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
                </TableCell>
                <TableCell>
                  <StageBadge stage={row.stage} />
                </TableCell>
                <TableCell>{row.assigned_to?.full_name ?? '—'}</TableCell>
                <TableCell>{formatDate(row.move_date)}</TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1.5">
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
                </TableCell>
                <TableCell>
                  {row.tags.length === 0 ? (
                    '—'
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {row.tags.map((tag) => (
                        <TagChip key={tag} tag={tag} />
                      ))}
                    </div>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
