'use client';

import { type InvoiceActionState, setInvoiceStatus } from '@/lib/actions/invoices';
import { type InvoiceStatus, canTransition } from '@/lib/invoices/status';
import { useActionState } from 'react';

const INITIAL: InvoiceActionState = { status: 'idle' };
const ALL: InvoiceStatus[] = ['draft', 'sent', 'partial', 'paid', 'overdue', 'void'];

export function StatusControl({
  id,
  version,
  status,
}: {
  id: string;
  version: number;
  status: InvoiceStatus;
}) {
  const [state, action, pending] = useActionState(setInvoiceStatus, INITIAL);
  const options = ALL.filter((s) => canTransition(status, s));

  if (options.length === 0) {
    return (
      <p className="text-xs text-[var(--color-muted-foreground)]">No further status changes.</p>
    );
  }

  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="version" value={version} />
      <select
        name="status"
        defaultValue={options[0]}
        className="rounded-md border bg-transparent px-2 py-1 text-sm"
      >
        {options.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border px-3 py-1 text-sm font-medium disabled:opacity-50"
      >
        {pending ? 'Saving…' : 'Update status'}
      </button>
      {state.status === 'error' ? (
        <span className="text-xs text-[var(--color-danger,#dc2626)]">{state.message}</span>
      ) : null}
    </form>
  );
}
