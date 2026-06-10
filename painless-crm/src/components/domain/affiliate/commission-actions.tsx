'use client';

import { type CommissionActionState, updateCommissionStatus } from '@/lib/actions/commissions';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

const INITIAL: CommissionActionState = { status: 'idle' };

export function CommissionActions({ id, status }: { id: string; status: string }) {
  const t = useTranslations('payouts');
  const [state, action, pending] = useActionState(updateCommissionStatus, INITIAL);

  const buttons: { action: string; label: string; primary?: boolean }[] = [];
  if (status === 'pending') {
    buttons.push({ action: 'approve', label: t('approve'), primary: true });
    buttons.push({ action: 'cancel', label: t('cancel') });
  } else if (status === 'approved') {
    buttons.push({ action: 'pay', label: t('markPaid'), primary: true });
    buttons.push({ action: 'cancel', label: t('cancel') });
  }
  if (buttons.length === 0) return null;

  return (
    <div className="flex items-center justify-end gap-2">
      {buttons.map((b) => (
        <form key={b.action} action={action}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="action" value={b.action} />
          <button
            type="submit"
            disabled={pending}
            className={`rounded-md px-2.5 py-1 text-xs font-medium disabled:opacity-50 ${
              b.primary
                ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)] hover:opacity-90'
                : 'border hover:bg-[var(--color-muted)]'
            }`}
          >
            {b.label}
          </button>
        </form>
      ))}
      {state.status === 'error' ? (
        <span className="text-xs text-[var(--color-danger)]">{state.message}</span>
      ) : null}
    </div>
  );
}
