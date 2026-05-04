'use client';

import { type CustomerActionState, softDeleteCustomer } from '@/lib/actions/customers';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

const INITIAL: CustomerActionState = { status: 'idle' };

export function DeleteCustomerButton({ id, version }: { id: string; version: number }) {
  const t = useTranslations('customers');
  const [state, action, pending] = useActionState(softDeleteCustomer, INITIAL);

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(t('confirmDelete'))) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="version" value={version} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-[var(--color-danger)] px-3 py-1.5 text-sm text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 disabled:opacity-50"
      >
        {t('delete')}
      </button>
      {state.status === 'error' ? (
        <p className="mt-2 text-xs text-[var(--color-danger)]">{state.message}</p>
      ) : null}
    </form>
  );
}
