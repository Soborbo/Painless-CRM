import { requireRole } from '@/lib/auth/require-role';
import { getInvoicesForJob } from '@/lib/queries/invoices';
import { getJobById } from '@/lib/queries/jobs';
import { formatPence } from '@/lib/utils/format';
import Link from 'next/link';

const BILLING_ROLES = ['accounts', 'manager', 'admin', 'super_admin'] as const;

type Props = { params: Promise<{ id: string }> };

export default async function JobInvoicesPage({ params }: Props) {
  await requireRole(BILLING_ROLES);
  const { id } = await params;
  const [invoices, job] = await Promise.all([getInvoicesForJob(id), getJobById(id)]);
  const customerId = job?.customer_id ?? '';
  const newHref = `/dashboard/invoices/new?job_id=${id}${customerId ? `&customer_id=${customerId}` : ''}`;

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <p className="text-sm text-[var(--color-muted-foreground)]">
        <Link href={`/dashboard/jobs/${id}`} className="hover:underline">
          ← Back to job
        </Link>
      </p>
      <div className="mt-1 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Invoices</h1>
        <Link
          href={newHref}
          className="rounded-md border bg-[var(--color-primary)] px-3 py-1.5 text-sm font-medium text-[var(--color-primary-foreground)]"
        >
          New invoice
        </Link>
      </div>

      <div className="mt-6 flex flex-col gap-2">
        {invoices.length === 0 ? (
          <p className="text-sm text-[var(--color-muted-foreground)]">
            No invoices for this job yet.
          </p>
        ) : (
          invoices.map((inv) => (
            <Link
              key={inv.id}
              href={`/dashboard/invoices/${inv.id}`}
              className="flex items-center justify-between rounded-md border p-3 text-sm hover:bg-[var(--color-muted)]"
            >
              <span>
                {inv.invoice_number} · {inv.type} · <span className="capitalize">{inv.status}</span>
              </span>
              <span className="tabular-nums">
                {formatPence(inv.total_pence)}
                <span className="ml-2 text-xs text-[var(--color-muted-foreground)]">
                  {formatPence(inv.amount_outstanding_pence)} due
                </span>
              </span>
            </Link>
          ))
        )}
      </div>
    </main>
  );
}
