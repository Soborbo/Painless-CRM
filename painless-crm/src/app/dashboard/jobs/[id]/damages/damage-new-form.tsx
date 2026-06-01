'use client';

import { type DamageActionState, createDamage } from '@/lib/actions/damages';
import { useActionState } from 'react';

const INITIAL: DamageActionState = { status: 'idle' };

export function DamageNewForm({ jobId }: { jobId: string }) {
  const [state, action, pending] = useActionState(createDamage, INITIAL);

  return (
    <form action={action} className="flex flex-col gap-3 rounded-md border p-4">
      <h2 className="text-sm font-medium">Log a damage claim</h2>
      <input type="hidden" name="job_id" value={jobId} />
      <label className="flex flex-col gap-1 text-sm">
        <span>Description *</span>
        <textarea name="description" rows={3} required className="rounded-md border px-3 py-2" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span>Estimated value (£)</span>
        <input
          name="estimated_value_pounds"
          type="number"
          step="0.01"
          min={0}
          className="rounded-md border px-3 py-2"
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="reported_by_customer" className="h-4 w-4" />
        Reported by the customer
      </label>
      {state.status === 'error' ? (
        <p className="text-sm text-[var(--color-danger,#dc2626)]">{state.message}</p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md border bg-[var(--color-primary)] px-3 py-1.5 text-sm font-medium text-[var(--color-primary-foreground)] disabled:opacity-50"
      >
        {pending ? 'Saving…' : 'Add claim'}
      </button>
    </form>
  );
}
