'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';

import { DataTable } from '@/components/ui/data-table';
import type { ExportLogRow } from '@/lib/queries/export-log';
import { summarizeFilters } from '@/lib/queries/export-log-format';
import { formatDateTime } from '@/lib/utils/format';

export function ExportsList({ rows }: { rows: ExportLogRow[] }) {
  const t = useTranslations('exports');
  const tSearch = useTranslations('search');

  const columns = useMemo<ColumnDef<ExportLogRow>[]>(
    () => [
      {
        accessorKey: 'exported_at',
        header: t('when'),
        cell: ({ row }) => (
          <span className="whitespace-nowrap">{formatDateTime(row.original.exported_at)}</span>
        ),
      },
      { accessorKey: 'resource', header: t('resource') },
      {
        accessorKey: 'format',
        header: t('format'),
        cell: ({ getValue }) => <span className="uppercase">{String(getValue())}</span>,
      },
      {
        accessorKey: 'row_count',
        header: t('rows'),
        cell: ({ getValue }) => (
          <span className="block text-right tabular-nums">{String(getValue())}</span>
        ),
      },
      {
        id: 'actor',
        accessorFn: (r) => r.actor_name ?? r.actor_email ?? '',
        header: t('actor'),
        cell: ({ row }) =>
          row.original.actor_name ??
          row.original.actor_email ?? (
            <span className="text-[var(--color-muted-foreground)]">{t('unknownActor')}</span>
          ),
      },
      {
        id: 'filters',
        accessorFn: (r) => summarizeFilters(r.filters),
        header: t('filters'),
        enableSorting: false,
        cell: ({ getValue }) => (
          <span className="text-[var(--color-muted-foreground)]">
            {(getValue() as string) || '—'}
          </span>
        ),
      },
      {
        accessorKey: 'ip_address',
        header: t('ip'),
        cell: ({ getValue }) => (
          <span className="whitespace-nowrap font-mono text-xs">
            {(getValue() as string) ?? '—'}
          </span>
        ),
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
