import type { CustomerRow } from '@/lib/queries/customers';
import { customerDisplayName, formatDate } from '@/lib/utils/format';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

export async function CustomerTable({ rows }: { rows: CustomerRow[] }) {
  const t = await getTranslations('customers');

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
            <th className="px-3 py-2 font-medium">{t('columns.name')}</th>
            <th className="px-3 py-2 font-medium">{t('columns.type')}</th>
            <th className="px-3 py-2 font-medium">{t('columns.email')}</th>
            <th className="px-3 py-2 font-medium">{t('columns.phone')}</th>
            <th className="px-3 py-2 font-medium">{t('columns.created')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t hover:bg-[var(--color-muted)]/40">
              <td className="px-3 py-2">
                <Link href={`/dashboard/customers/${row.id}`} className="hover:underline">
                  {customerDisplayName(row)}
                </Link>
              </td>
              <td className="px-3 py-2">
                <TypeBadge type={row.customer_type} />
              </td>
              <td className="px-3 py-2">{row.primary_email ?? '—'}</td>
              <td className="px-3 py-2">{row.primary_phone ?? '—'}</td>
              <td className="px-3 py-2">{formatDate(row.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
