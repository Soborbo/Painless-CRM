'use client';

import { type DamageActionState, updateDamage } from '@/lib/actions/damages';
import type { DamageStatus } from '@/lib/damages/state-machine';
import { useActionState } from 'react';

const INITIAL: DamageActionState = { status: 'idle' };
const NEXT: Record<DamageStatus, DamageStatus[]> = {
  reported: ['investigating', 'denied'],
  investigating: ['agreed', 'denied'],
  agreed: ['paid', 'denied'],
  paid: [],
  denied: [],
};

export function DamageEdit({
  id,
  version,
  status,
  estimatedPence,
  payoutPence,
  insuranceRef,
}: {
  id: string;
  version: number;
  status: DamageStatus;
  estimatedPence: number | null;
  payoutPence: number | null;
  insuranceRef: string | null;
}) {
  const [state, action, pending] = useActionState(updateDamage, INITIAL);
  const options = NEXT[status];

  return (
    <form action={action} className="mt-3 flex flex-col gap-2 border-t pt-3">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="version" value={version} />
      <div className="grid grid-cols-2 gap-2 text-sm">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-[var(--color-muted-foreground)]">Status</span>
          <select
            name="status"
            defaultValue={status}
            className="rounded-md border bg-transparent px-2 py-1"
          >
            <option value={status}>{status}</option>
            {options.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-[var(--color-muted-foreground)]">Insurance ref</span>
          <input
            name="insurance_claim_ref"
            defaultValue={insuranceRef ?? ''}
            className="rounded-md border px-2 py-1"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-[var(--color-muted-foreground)]">Estimated (£)</span>
          <input
            name="estimated_value_pounds"
            type="number"
            step="0.01"
            min={0}
            defaultValue={estimatedPence != null ? estimatedPence / 100 : ''}
            className="rounded-md border px-2 py-1"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-[var(--color-muted-foreground)]">Payout (£)</span>
          <input
            name="payout_pounds"
            type="number"
            step="0.01"
            min={0}
            defaultValue={payoutPence != null ? payoutPence / 100 : ''}
            className="rounded-md border px-2 py-1"
          />
        </label>
      </div>
      {state.status === 'error' ? (
        <p className="text-xs text-[var(--color-danger,#dc2626)]">{state.message}</p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md border px-3 py-1 text-xs font-medium disabled:opacity-50"
      >
        {pending ? 'Saving…' : 'Update claim'}
      </button>
    </form>
  );
}
