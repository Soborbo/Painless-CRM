'use client';

import { type JobActionState, assignJob } from '@/lib/actions/jobs';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

const INITIAL: JobActionState = { status: 'idle' };

export function AssignmentControl({
  id,
  version,
  assignedToId,
  reps,
  canChange,
}: {
  id: string;
  version: number;
  assignedToId: string | null;
  reps: { id: string; full_name: string }[];
  canChange: boolean;
}) {
  const t = useTranslations('jobs');
  const tc = useTranslations('common');
  const [state, action, pending] = useActionState(assignJob, INITIAL);
  const current = reps.find((r) => r.id === assignedToId);

  return (
    <div className="rounded-md border p-4">
      <h3 className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
        {t('assigned')}
      </h3>
      <p className="mt-3 text-sm">{current?.full_name ?? t('unassigned')}</p>

      {canChange ? (
        <form action={action} className="mt-3 flex flex-col gap-2">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="version" value={version} />
          <select
            name="assigned_to_id"
            defaultValue={assignedToId ?? ''}
            className="rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:ring-2"
          >
            <option value="" disabled>
              {t('selectRep')}
            </option>
            {reps.map((r) => (
              <option key={r.id} value={r.id}>
                {r.full_name}
              </option>
            ))}
          </select>
          {state.status === 'error' ? (
            <p className="text-xs text-[var(--color-danger)]">{state.message}</p>
          ) : null}
          <button
            type="submit"
            disabled={pending}
            className="self-start rounded-md border px-3 py-1.5 text-xs hover:bg-[var(--color-muted)] disabled:opacity-50"
          >
            {pending ? tc('loading') : t('reassign')}
          </button>
        </form>
      ) : null}
    </div>
  );
}
