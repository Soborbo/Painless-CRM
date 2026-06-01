'use client';

import { type PaymentActionState, recordPayment } from '@/lib/actions/payments';
import type { InvoicePaymentRow } from '@/lib/queries/invoices';
import { PAYMENT_METHODS } from '@/lib/schemas/payment';
import { formatDate, formatPence } from '@/lib/utils/format';
import { useActionState } from 'react';

const INITIAL: PaymentActionState = { status: 'idle' };

export function PaymentPanel({
  invoiceId,
  payments,
  canRecord,
}: {
  invoiceId: string;
  payments: InvoicePaymentRow[];
  canRecord: boolean;
}) {
  const [state, action, pending] = useActionState(recordPayment, INITIAL);

  return (
    <section className="rounded-md border p-4">
      <h2 className="text-sm font-semibold">Payments</h2>

      {payments.length === 0 ? (
        <p className="mt-2 text-xs text-[var(--color-muted-foreground)]">No payments recorded.</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1 text-sm">
          {payments.map((p) => (
            <li key={p.id} className="flex justify-between">
              <span>
                {formatDate(p.occurred_at)} · {p.method ?? 'payment'}
                {p.reference ? ` · ${p.reference}` : ''}
              </span>
              <span className="tabular-nums">{formatPence(p.amount_pence)}</span>
            </li>
          ))}
        </ul>
      )}

      {canRecord ? (
        <form
          action={action}
          className="mt-4 grid grid-cols-2 gap-2 border-t pt-4 text-sm md:grid-cols-4"
        >
          <input type="hidden" name="invoice_id" value={invoiceId} />
          <input
            name="amount_pounds"
            type="number"
            step="0.01"
            min={0}
            placeholder="Amount £ *"
            required
            className="rounded-md border px-2 py-1"
          />
          <select
            name="method"
            defaultValue="bank_transfer"
            className="rounded-md border bg-transparent px-2 py-1"
          >
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {m.replace('_', ' ')}
              </option>
            ))}
          </select>
          <input name="occurred_at" type="date" className="rounded-md border px-2 py-1" />
          <input name="reference" placeholder="Reference" className="rounded-md border px-2 py-1" />
          <button
            type="submit"
            disabled={pending}
            className="rounded-md border bg-[var(--color-primary)] px-3 py-1 font-medium text-[var(--color-primary-foreground)] disabled:opacity-50 md:col-span-4"
          >
            {pending ? 'Recording…' : 'Record payment'}
          </button>
        </form>
      ) : null}
      {state.status === 'error' ? (
        <p className="mt-2 text-xs text-[var(--color-danger,#dc2626)]">{state.message}</p>
      ) : null}
    </section>
  );
}
