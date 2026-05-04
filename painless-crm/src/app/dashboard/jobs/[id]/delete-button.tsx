'use client';

import { type JobActionState, softDeleteJob } from '@/lib/actions/jobs';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

const INITIAL: JobActionState = { status: 'idle' };

export function DeleteJobButton({ id, version }: { id: string; version: number }) {
  const t = useTranslations('jobs');
  const [state, action, pending] = useActionState(softDeleteJob, INITIAL);

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
