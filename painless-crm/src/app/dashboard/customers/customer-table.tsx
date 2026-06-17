import { SortableHeader } from '@/components/ui/sortable-header';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { CustomerRow } from '@/lib/queries/customers';
import { customerDisplayName, formatDate } from '@/lib/utils/format';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

export async function CustomerTable({
  rows,
  sort,
  dir,
  params,
}: {
  rows: CustomerRow[];
  sort?: string;
  dir?: 'asc' | 'desc';
  params?: Record<string, string | undefined>;
}) {
  const t = await getTranslations('customers');

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
              <SortableHeader label={t('columns.name')} column="last_name" {...sortProps} />
            </TableHead>
            <TableHead>
              <SortableHeader label={t('columns.type')} column="customer_type" {...sortProps} />
            </TableHead>
            <TableHead>
              <SortableHeader label={t('columns.email')} column="primary_email" {...sortProps} />
            </TableHead>
            <TableHead>
              <SortableHeader label={t('columns.phone')} column="primary_phone" {...sortProps} />
            </TableHead>
            <TableHead>
              <SortableHeader label={t('columns.created')} column="created_at" {...sortProps} />
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                <Link href={`/dashboard/customers/${row.id}`} className="hover:underline">
                  {customerDisplayName(row)}
                </Link>
              </TableCell>
              <TableCell>
                <TypeBadge type={row.customer_type} />
              </TableCell>
              <TableCell>{row.primary_email ?? '—'}</TableCell>
              <TableCell>{row.primary_phone ?? '—'}</TableCell>
              <TableCell>{formatDate(row.created_at)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function TypeBadge({ type }: { type: 'individual' | 'business' }) {
  const cls =
    type === 'business'
      ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
      : 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]';
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium uppercase tracking-wide ${cls}`}>
      {type}
    </span>
  );
}
