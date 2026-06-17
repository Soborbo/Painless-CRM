import { requireRole } from '@/lib/auth/require-role';
import { listInvoices } from '@/lib/queries/invoices';
import Link from 'next/link';

import { InvoicesTable } from './invoices-table';

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

      <div className="mt-6">
        <InvoicesTable rows={invoices} />
      </div>
    </main>
  );
}
