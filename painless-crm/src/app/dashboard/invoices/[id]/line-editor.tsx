'use client';

import {
  type InvoiceLineActionState,
  addInvoiceLine,
  removeInvoiceLine,
} from '@/lib/actions/invoice-lines';
import type { InvoiceLineRow } from '@/lib/queries/invoices';
import { formatPence } from '@/lib/utils/format';
import { useActionState } from 'react';

const INITIAL: InvoiceLineActionState = { status: 'idle' };

export function LineEditor({
  invoiceId,
  lines,
  editable,
}: {
  invoiceId: string;
  lines: InvoiceLineRow[];
  editable: boolean;
}) {
  const [addState, addAction, adding] = useActionState(addInvoiceLine, INITIAL);
  const [, removeAction] = useActionState(removeInvoiceLine, INITIAL);

  return (
    <section className="rounded-md border p-4">
      <h2 className="text-sm font-semibold">Lines</h2>
      <table className="mt-3 w-full text-left text-sm">
        <thead className="border-b text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
          <tr>
            <th className="py-1">Description</th>
            <th className="py-1 text-right">Qty</th>
            <th className="py-1 text-right">Unit</th>
            <th className="py-1 text-right">VAT %</th>
            <th className="py-1 text-right">Line total</th>
            {editable ? <th className="py-1" /> : null}
          </tr>
        </thead>
        <tbody>
          {lines.length === 0 ? (
            <tr>
              <td colSpan={editable ? 6 : 5} className="py-3 text-[var(--color-muted-foreground)]">
                No lines yet.
              </td>
            </tr>
          ) : (
            lines.map((l) => (
              <tr key={l.id} className="border-b">
                <td className="py-1">{l.description}</td>
                <td className="py-1 text-right tabular-nums">{l.quantity}</td>
                <td className="py-1 text-right tabular-nums">{formatPence(l.unit_price_pence)}</td>
                <td className="py-1 text-right tabular-nums">{l.vat_rate}%</td>
                <td className="py-1 text-right tabular-nums">{formatPence(l.line_total_pence)}</td>
                {editable ? (
                  <td className="py-1 text-right">
                    <form action={removeAction}>
                      <input type="hidden" name="id" value={l.id} />
                      <input type="hidden" name="invoice_id" value={invoiceId} />
                      <button
                        type="submit"
                        className="text-xs text-[var(--color-danger,#dc2626)] hover:underline"
                      >
                        Remove
                      </button>
                    </form>
                  </td>
                ) : null}
              </tr>
            ))
          )}
        </tbody>
      </table>

      {editable ? (
        <form
          action={addAction}
          className="mt-4 grid grid-cols-2 gap-2 border-t pt-4 text-sm md:grid-cols-6"
        >
          <input type="hidden" name="invoice_id" value={invoiceId} />
          <input
            name="description"
            placeholder="Description *"
            required
            className="rounded-md border px-2 py-1 md:col-span-3"
          />
          <input
            name="quantity"
            type="number"
            step="any"
            min={0}
            defaultValue={1}
            placeholder="Qty"
            className="rounded-md border px-2 py-1"
          />
          <input
            name="unit_price_pounds"
            type="number"
            step="0.01"
            min={0}
            placeholder="Unit £ *"
            required
            className="rounded-md border px-2 py-1"
          />
          <input
            name="vat_rate"
            type="number"
            step="any"
            min={0}
            defaultValue={20}
            placeholder="VAT %"
            className="rounded-md border px-2 py-1"
          />
          <button
            type="submit"
            disabled={adding}
            className="rounded-md border bg-[var(--color-primary)] px-3 py-1 font-medium text-[var(--color-primary-foreground)] disabled:opacity-50 md:col-span-6"
          >
            {adding ? 'Adding…' : 'Add line'}
          </button>
        </form>
      ) : (
        <p className="mt-3 text-xs text-[var(--color-muted-foreground)]">
          Lines are locked once the invoice leaves draft.
        </p>
      )}
      {addState.status === 'error' ? (
        <p className="mt-2 text-xs text-[var(--color-danger,#dc2626)]">{addState.message}</p>
      ) : null}
    </section>
  );
}
