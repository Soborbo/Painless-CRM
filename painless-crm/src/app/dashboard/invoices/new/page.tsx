import { requireRole } from '@/lib/auth/require-role';
import { listCustomerOptions } from '@/lib/queries/customers';
import Link from 'next/link';
import { InvoiceCreateForm } from '../invoice-create-form';

const BILLING_ROLES = ['accounts', 'manager', 'admin', 'super_admin'] as const;

type Props = { searchParams: Promise<{ customer_id?: string; job_id?: string }> };

export default async function NewInvoicePage({ searchParams }: Props) {
  await requireRole(BILLING_ROLES);
  const { customer_id, job_id } = await searchParams;
  const customers = await listCustomerOptions();

  return (
    <main className="mx-auto max-w-2xl px-6 py-8">
      <p className="text-sm text-[var(--color-muted-foreground)]">
        <Link href="/dashboard/invoices" className="hover:underline">
          ← Invoices
        </Link>
      </p>
      <h1 className="mt-1 mb-6 text-xl font-semibold">New invoice</h1>
      <InvoiceCreateForm
        customers={customers}
        presetCustomerId={customer_id}
        presetJobId={job_id}
      />
    </main>
  );
}
