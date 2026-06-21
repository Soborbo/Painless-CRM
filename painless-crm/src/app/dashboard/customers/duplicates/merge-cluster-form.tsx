'use client';

import { type MergeActionState, mergeCustomers } from '@/lib/actions/customer-merge';
import { useTranslations } from 'next-intl';
import { useActionState, useState } from 'react';

type Member = { id: string; name: string };

const INITIAL: MergeActionState = { status: 'idle' };

// Pick the record to keep, then fold the rest of the cluster into it. Guarded by
// a confirm — a merge re-points jobs/invoices and soft-deletes the duplicates.
export function MergeClusterForm({ members }: { members: Member[] }) {
  const t = useTranslations('customers');
  const [state, action, pending] = useActionState(mergeCustomers, INITIAL);
  const [winner, setWinner] = useState(members[0]?.id ?? '');

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(t('mergeConfirm'))) e.preventDefault();
      }}
      className="flex flex-wrap items-center gap-3 border-t bg-[var(--color-muted)]/20 px-4 py-3 text-sm print:hidden"
    >
      <input type="hidden" name="winner_id" value={winner} />
      {members.map((m) => (
        <input key={m.id} type="hidden" name="member_id" value={m.id} />
      ))}
      <label className="flex items-center gap-2">
        <span className="text-[var(--color-muted-foreground)]">{t('mergeKeep')}</span>
        <select
          value={winner}
          onChange={(e) => setWinner(e.target.value)}
          className="rounded-md border bg-transparent px-2 py-1.5"
        >
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
      >
        {pending ? t('merging') : t('mergeButton')}
      </button>
      {state.status === 'error' ? (
        <span className="text-xs text-[var(--color-danger)]">{state.message}</span>
      ) : null}
      {state.status === 'ok' ? (
        <span className="text-xs text-emerald-700">{t('mergeDone', { count: state.merged })}</span>
      ) : null}
    </form>
  );
}
