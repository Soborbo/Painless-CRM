import { requireRole } from '@/lib/auth/require-role';
import type { InvoiceStatus } from '@/lib/invoices/status';
import { isEditable } from '@/lib/invoices/status';
import { getInvoice } from '@/lib/queries/invoices';
import { formatDate, formatPence } from '@/lib/utils/format';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LineEditor } from './line-editor';
import { StatusControl } from './status-control';

const BILLING_ROLES = ['accounts', 'manager', 'admin', 'super_admin'] as const;

type Props = { params: Promise<{ id: string }> };

export default async function InvoiceDetailPage({ params }: Props) {
  await requireRole(BILLING_ROLES);
  const { id } = await params;
  const invoice = await getInvoice(id);
  if (!invoice) notFound();

  const status = (invoice.status ?? 'draft') as InvoiceStatus;

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            <Link href="/dashboard/invoices" className="hover:underline">
              ← Invoices
            </Link>
          </p>
          <h1 className="mt-1 text-xl font-semibold">{invoice.invoice_number}</h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            {invoice.customer_name} · {invoice.type} · <span className="capitalize">{status}</span>
            {invoice.due_at ? ` · due ${formatDate(invoice.due_at)}` : ''}
          </p>
          {invoice.job_id ? (
            <Link
              href={`/dashboard/jobs/${invoice.job_id}`}
              className="text-sm text-[var(--color-primary)] hover:underline"
            >
              View job
            </Link>
          ) : null}
        </div>
        <StatusControl id={invoice.id} version={invoice.version} status={status} />
      </header>

      <LineEditor invoiceId={invoice.id} lines={invoice.lines} editable={isEditable(status)} />

      <section className="rounded-md border p-4 text-sm">
        <dl className="ml-auto flex max-w-xs flex-col gap-1">
          <Row label="Subtotal" value={formatPence(invoice.subtotal_pence)} />
          <Row label="VAT" value={formatPence(invoice.vat_pence)} />
          <Row label="Total" value={formatPence(invoice.total_pence)} bold />
          <Row label="Paid" value={formatPence(invoice.amount_paid_pence)} />
          <Row label="Outstanding" value={formatPence(invoice.amount_outstanding_pence)} bold />
        </dl>
      </section>
    </main>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between gap-8 ${bold ? 'font-semibold' : ''}`}>
      <dt className="text-[var(--color-muted-foreground)]">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
