'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useMemo } from 'react';

import { CompleteCallbackButton } from '@/components/domain/job/complete-callback-button';
import { DataTable } from '@/components/ui/data-table';
import type { CallbackRow } from '@/lib/queries/callbacks';
import { customerDisplayName, formatDateTime } from '@/lib/utils/format';

export type CallbackTableRow = CallbackRow & { overdue: boolean };

export function CallbacksTable({ rows }: { rows: CallbackTableRow[] }) {
  const t = useTranslations('callbacks');
  const tc = useTranslations('phoneCalls');
  const tSearch = useTranslations('search');

  const columns = useMemo<ColumnDef<CallbackTableRow>[]>(
    () => [
      {
        accessorKey: 'next_action_due_at',
        header: t('columns.dueAt'),
        cell: ({ row }) => (
          <span className="whitespace-nowrap tabular-nums">
            {formatDateTime(row.original.next_action_due_at)}
            {row.original.overdue ? (
              <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-red-700">
                {t('overdue')}
              </span>
            ) : null}
          </span>
        ),
      },
      {
        id: 'customer',
        accessorFn: (r) => (r.customer ? customerDisplayName(r.customer) : ''),
        header: t('columns.customer'),
        cell: ({ row }) =>
          row.original.customer ? customerDisplayName(row.original.customer) : '—',
      },
      {
        accessorKey: 'job_number',
        header: t('columns.job'),
        cell: ({ row }) =>
          row.original.job_id ? (
            <Link
              href={`/dashboard/jobs/${row.original.job_id}`}
              className="font-mono hover:underline"
            >
              {row.original.job_number ?? '—'}
            </Link>
          ) : (
            '—'
          ),
      },
      {
        accessorKey: 'next_action',
        header: t('columns.action'),
        cell: ({ getValue }) => (getValue() as string | null) ?? '—',
      },
      {
        accessorKey: 'outcome',
        header: t('columns.outcome'),
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-[var(--color-muted-foreground)]">
            {row.original.outcome ? tc(`outcomes.${row.original.outcome}` as never) : '—'}
          </span>
        ),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => (
          <span className="block text-right">
            <CompleteCallbackButton phoneCallId={row.original.id} />
          </span>
        ),
      },
    ],
    [t, tc],
  );

  return (
    <DataTable
      columns={columns}
      data={rows}
      filterPlaceholder={tSearch('label')}
      emptyMessage={t('empty')}
    />
  );
}
