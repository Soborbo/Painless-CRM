'use client';

import { type InvoiceActionState, createInvoice } from '@/lib/actions/invoices';
import type { CustomerOption } from '@/lib/queries/customers';
import { INVOICE_TYPES } from '@/lib/schemas/invoice';
import { useActionState } from 'react';

const INITIAL: InvoiceActionState = { status: 'idle' };

export function InvoiceCreateForm({
  customers,
  presetCustomerId,
  presetJobId,
}: {
  customers: CustomerOption[];
  presetCustomerId?: string;
  presetJobId?: string;
}) {
  const [state, action, pending] = useActionState(createInvoice, INITIAL);

  return (
    <form action={action} className="flex max-w-md flex-col gap-4">
      {presetJobId ? <input type="hidden" name="job_id" value={presetJobId} /> : null}

      <label className="flex flex-col gap-1 text-sm">
        <span>Customer *</span>
        <select
          name="customer_id"
          defaultValue={presetCustomerId ?? ''}
          required
          className="rounded-md border bg-transparent px-3 py-2"
        >
          <option value="" disabled>
            Select a customer
          </option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span>Type *</span>
        <select
          name="type"
          defaultValue="final"
          className="rounded-md border bg-transparent px-3 py-2"
        >
          {INVOICE_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span>Due date</span>
        <input type="date" name="due_at" className="rounded-md border px-3 py-2" />
      </label>

      {state.status === 'error' ? (
        <p className="text-sm text-[var(--color-danger,#dc2626)]">{state.message}</p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md border bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-foreground)] disabled:opacity-50"
      >
        {pending ? 'Creating…' : 'Create draft invoice'}
      </button>
    </form>
  );
}
