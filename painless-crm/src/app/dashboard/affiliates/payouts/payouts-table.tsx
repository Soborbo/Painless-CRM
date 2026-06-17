'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useMemo } from 'react';

import { CommissionActions } from '@/components/domain/affiliate/commission-actions';
import { DataTable } from '@/components/ui/data-table';
import type { CommissionRow } from '@/lib/queries/commissions';
import { formatDate, formatPence } from '@/lib/utils/format';

export function PayoutsTable({ rows }: { rows: CommissionRow[] }) {
  const t = useTranslations('payouts');
  const tSearch = useTranslations('search');

  const columns = useMemo<ColumnDef<CommissionRow>[]>(
    () => [
      {
        id: 'affiliate',
        accessorFn: (r) => r.affiliate_name ?? '',
        header: t('cols.affiliate'),
        cell: ({ row }) => (
          <Link
            href={`/dashboard/affiliates/${row.original.affiliate_id}`}
            className="font-medium hover:underline"
          >
            {row.original.affiliate_name ?? '—'}
          </Link>
        ),
      },
      {
        accessorKey: 'job_number',
        header: t('cols.job'),
        cell: ({ row }) => (row.original.job_number != null ? `#${row.original.job_number}` : '—'),
      },
      {
        accessorKey: 'amount_pence',
        header: t('cols.amount'),
        cell: ({ row }) => (
          <span className="block text-right tabular-nums">
            {formatPence(row.original.amount_pence)}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: t('cols.status'),
        cell: ({ row }) => t(`statuses.${row.original.status}`),
      },
      {
        accessorKey: 'created_at',
        header: t('cols.created'),
        cell: ({ row }) => formatDate(row.original.created_at),
      },
      {
        id: 'actions',
        header: t('cols.actions'),
        enableSorting: false,
        cell: ({ row }) => <CommissionActions id={row.original.id} status={row.original.status} />,
      },
    ],
    [t],
  );

  return (
    <DataTable
      columns={columns}
      data={rows}
      pageSize={25}
      filterPlaceholder={tSearch('label')}
      emptyMessage={t('empty')}
    />
  );
}
