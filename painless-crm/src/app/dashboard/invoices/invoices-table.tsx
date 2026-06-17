'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useMemo } from 'react';

import { DataTable } from '@/components/ui/data-table';
import type { InvoiceListRow } from '@/lib/queries/invoices';
import { formatDate, formatPence } from '@/lib/utils/format';

export function InvoicesTable({ rows }: { rows: InvoiceListRow[] }) {
  const tSearch = useTranslations('search');

  const columns = useMemo<ColumnDef<InvoiceListRow>[]>(
    () => [
      {
        accessorKey: 'invoice_number',
        header: 'Number',
        cell: ({ row }) => (
          <Link href={`/dashboard/invoices/${row.original.id}`} className="hover:underline">
            {row.original.invoice_number}
          </Link>
        ),
      },
      { accessorKey: 'customer_name', header: 'Customer' },
      { accessorKey: 'type', header: 'Type' },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ getValue }) => <span className="capitalize">{getValue() as string}</span>,
      },
      {
        accessorKey: 'total_pence',
        header: () => <span className="block text-right">Total</span>,
        cell: ({ getValue }) => (
          <span className="block text-right tabular-nums">{formatPence(getValue() as number)}</span>
        ),
      },
      {
        accessorKey: 'amount_outstanding_pence',
        header: () => <span className="block text-right">Outstanding</span>,
        cell: ({ getValue }) => (
          <span className="block text-right tabular-nums">{formatPence(getValue() as number)}</span>
        ),
      },
      {
        accessorKey: 'due_at',
        header: 'Due',
        cell: ({ getValue }) => {
          const due = getValue() as string | null;
          return <span>{due ? formatDate(due) : '—'}</span>;
        },
      },
    ],
    [],
  );

  return (
    <DataTable
      columns={columns}
      data={rows}
      pageSize={25}
      filterPlaceholder={tSearch('label')}
      emptyMessage="No invoices yet."
    />
  );
}
