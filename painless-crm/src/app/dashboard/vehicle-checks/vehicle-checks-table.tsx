'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useMemo } from 'react';

import { DataTable } from '@/components/ui/data-table';
import type { VehicleCheckListRow } from '@/lib/queries/vehicle-checks';
import { formatDateTime } from '@/lib/utils/format';
import { vehicleCheckFlags } from '@/lib/worker/vehicle-check-view';

export function VehicleChecksTable({ rows }: { rows: VehicleCheckListRow[] }) {
  const t = useTranslations('vehicleChecks');
  const tSearch = useTranslations('search');

  const columns = useMemo<ColumnDef<VehicleCheckListRow>[]>(
    () => [
      {
        accessorKey: 'submitted_at',
        header: t('colSubmitted'),
        cell: ({ row }) => (
          <span className="whitespace-nowrap">{formatDateTime(row.original.submitted_at)}</span>
        ),
      },
      {
        accessorKey: 'registration',
        header: t('colVehicle'),
        cell: ({ row }) => <span className="font-medium">{row.original.registration}</span>,
      },
      {
        accessorKey: 'worker_name',
        header: t('colWorker'),
      },
      {
        id: 'job',
        accessorFn: (r) => r.job_number ?? '',
        header: t('colJob'),
        cell: ({ row }) => {
          const c = row.original;
          return c.job_id && c.job_number ? (
            <Link href={`/dashboard/jobs/${c.job_id}`} className="hover:underline">
              {c.job_number}
            </Link>
          ) : (
            '—'
          );
        },
      },
      {
        accessorKey: 'fuel_level',
        header: t('colFuel'),
        cell: ({ row }) => {
          const c = row.original;
          const flags = vehicleCheckFlags(c);
          return c.fuel_level == null ? (
            '—'
          ) : (
            <span className={flags.lowFuel ? 'font-medium text-red-700' : undefined}>
              {c.fuel_level}%
            </span>
          );
        },
      },
      {
        accessorKey: 'mileage',
        header: t('colMileage'),
        cell: ({ row }) =>
          row.original.mileage == null ? '—' : row.original.mileage.toLocaleString(),
      },
      {
        id: 'status',
        enableSorting: false,
        header: t('colStatus'),
        cell: ({ row }) => {
          const c = row.original;
          const flags = vehicleCheckFlags(c);
          return flags.needsAttention ? (
            <span className="text-red-700">
              {flags.failedWalkAround
                ? t('statusDefects')
                : flags.hasDefects
                  ? t('statusDefects')
                  : t('statusLowFuel')}
              {c.defects_noted ? ` — ${c.defects_noted}` : ''}
            </span>
          ) : (
            <span className="text-emerald-700">{t('statusClear')}</span>
          );
        },
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
      emptyMessage={t('none')}
    />
  );
}
