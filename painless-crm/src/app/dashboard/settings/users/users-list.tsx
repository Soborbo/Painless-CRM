'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';

import { DataTable } from '@/components/ui/data-table';

type UserRow = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  active: boolean;
  created_at: string;
};

export function UsersList({ rows, currentUserId }: { rows: UserRow[]; currentUserId: string }) {
  const t = useTranslations('users');
  const tSearch = useTranslations('search');

  const columns = useMemo<ColumnDef<UserRow>[]>(
    () => [
      {
        accessorKey: 'full_name',
        header: t('fullName'),
        cell: ({ row }) => (
          <>
            {row.original.full_name}
            {row.original.id === currentUserId ? (
              <span className="ml-1 text-xs text-[var(--color-muted-foreground)]">
                ({t('you')})
              </span>
            ) : null}
          </>
        ),
      },
      { accessorKey: 'email', header: t('inviteEmail') },
      {
        accessorKey: 'role',
        header: t('inviteRole'),
        cell: ({ getValue }) => t(`roles.${String(getValue())}` as never),
      },
      {
        accessorKey: 'active',
        header: t('status'),
        cell: ({ getValue }) => (getValue() ? t('statusActive') : t('statusInactive')),
      },
    ],
    [t, currentUserId],
  );

  return (
    <DataTable
      columns={columns}
      data={rows}
      filterPlaceholder={tSearch('label')}
      emptyMessage={t('noTeamMembers')}
    />
  );
}
