import { requireRole } from '@/lib/auth/require-role';
import { getCustomerById } from '@/lib/queries/customers';
import { getCustomerStatement } from '@/lib/queries/statements';
import { customerDisplayName, formatDate, formatPence } from '@/lib/utils/format';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';

const ROLES = ['accounts', 'manager', 'admin', 'super_admin'] as const;

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

export default async function StatementPage({ params }: Props) {
  await requireRole(ROLES);
  const { id } = await params;
  const customer = await getCustomerById(id);
  if (!customer) notFound();

  const [statement, t] = await Promise.all([
    getCustomerStatement(id),
    getTranslations('statement'),
  ]);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-5 px-6 py-8">
      <nav className="text-sm text-[var(--color-muted-foreground)]">
        <Link href={`/dashboard/customers/${id}`} className="hover:underline">
          {customerDisplayName(customer)}
        </Link>
        <span className="mx-1.5">/</span>
        <span>{t('title')}</span>
      </nav>

      <header className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">{t('title')}</h1>
        <Link
          href={`/dashboard/customers/${id}/statement/export`}
          className="rounded-md border px-3 py-1.5 text-sm hover:bg-[var(--color-muted)]"
        >
          {t('exportCsv')}
        </Link>
      </header>

      <div className="grid grid-cols-3 gap-3">
        <Tile label={t('invoiced')} value={formatPence(statement.totalInvoicedPence)} />
        <Tile label={t('paid')} value={formatPence(statement.totalPaidPence)} />
        <Tile label={t('outstanding')} value={formatPence(statement.totalOutstandingPence)} />
      </div>

      {statement.lines.length === 0 ? (
        <p className="rounded-md border p-6 text-sm text-[var(--color-muted-foreground)]">
          {t('empty')}
        </p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-[var(--color-muted-foreground)]">
              <th className="py-2">{t('date')}</th>
              <th>{t('invoice')}</th>
              <th>{t('status')}</th>
              <th className="text-right">{t('total')}</th>
              <th className="text-right">{t('outstanding')}</th>
              <th className="text-right">{t('balance')}</th>
            </tr>
          </thead>
          <tbody>
            {statement.lines.map((l) => (
              <tr key={l.invoice_number} className="border-b">
                <td className="py-2">{l.issued_at ? formatDate(l.issued_at) : '—'}</td>
                <td className="font-mono">{l.invoice_number}</td>
                <td>{l.status ?? '—'}</td>
                <td className="text-right tabular-nums">{formatPence(l.total_pence)}</td>
                <td className="text-right tabular-nums">
                  {formatPence(l.amount_outstanding_pence)}
                </td>
                <td className="text-right font-medium tabular-nums">
                  {formatPence(l.running_outstanding_pence)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-4">
      <p className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}
