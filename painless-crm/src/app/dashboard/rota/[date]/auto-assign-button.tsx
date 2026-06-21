'use client';

import { type RotaActionState, autoAssignWorker } from '@/lib/actions/rota';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

const INITIAL: RotaActionState = { status: 'idle' };

// Books the least-busy available crew member onto this job for the day in one
// click. The office can fine-tune role/vehicle/time afterwards with the manual
// assign form; this just gets a body on the job fast.
export function AutoAssignButton({ jobId, date }: { jobId: string; date: string }) {
  const t = useTranslations('rota');
  const [state, action, pending] = useActionState(autoAssignWorker, INITIAL);

  return (
    <form action={action} className="flex flex-wrap items-center gap-2 text-sm print:hidden">
      <input type="hidden" name="job_id" value={jobId} />
      <input type="hidden" name="date" value={date} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border px-3 py-1.5 font-medium transition-colors hover:bg-[var(--color-muted)] disabled:opacity-50"
      >
        {pending ? t('autoAssigning') : t('autoAssign')}
      </button>
      {state.status === 'error' ? (
        <span className="text-xs text-[var(--color-danger)]">{state.message}</span>
      ) : null}
    </form>
  );
}
