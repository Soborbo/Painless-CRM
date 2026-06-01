import { requireRole } from '@/lib/auth/require-role';
import { listInvoices } from '@/lib/queries/invoices';
import { formatDate, formatPence } from '@/lib/utils/format';
import Link from 'next/link';

const BILLING_ROLES = ['accounts', 'manager', 'admin', 'super_admin'] as const;

export default async function InvoicesPage() {
  await requireRole(BILLING_ROLES);
  const invoices = await listInvoices();

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Invoices</h1>
        <Link
          href="/dashboard/invoices/new"
          className="rounded-md border bg-[var(--color-primary)] px-3 py-1.5 text-sm font-medium text-[var(--color-primary-foreground)]"
        >
          New invoice
        </Link>
      </div>

      <table className="mt-6 w-full text-left text-sm">
        <thead className="border-b text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
          <tr>
            <th className="py-2">Number</th>
            <th className="py-2">Customer</th>
            <th className="py-2">Type</th>
            <th className="py-2">Status</th>
            <th className="py-2 text-right">Total</th>
            <th className="py-2 text-right">Outstanding</th>
            <th className="py-2">Due</th>
          </tr>
        </thead>
        <tbody>
          {invoices.length === 0 ? (
            <tr>
              <td colSpan={7} className="py-4 text-[var(--color-muted-foreground)]">
                No invoices yet.
              </td>
            </tr>
          ) : (
            invoices.map((inv) => (
              <tr key={inv.id} className="border-b">
                <td className="py-2">
                  <Link href={`/dashboard/invoices/${inv.id}`} className="hover:underline">
                    {inv.invoice_number}
                  </Link>
                </td>
                <td className="py-2">{inv.customer_name}</td>
                <td className="py-2">{inv.type}</td>
                <td className="py-2 capitalize">{inv.status}</td>
                <td className="py-2 text-right tabular-nums">{formatPence(inv.total_pence)}</td>
                <td className="py-2 text-right tabular-nums">
                  {formatPence(inv.amount_outstanding_pence)}
                </td>
                <td className="py-2">{inv.due_at ? formatDate(inv.due_at) : '—'}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </main>
  );
}
