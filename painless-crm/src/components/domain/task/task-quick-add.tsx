'use client';

import { INITIAL_TASK_STATE, type TaskActionState, createTask } from '@/lib/actions/tasks';
import type { TaskAssignee } from '@/lib/queries/tasks';
import type { TaskKind, TaskRelatedType } from '@/lib/tasks/model';
import { useTranslations } from 'next-intl';
import { useActionState, useRef } from 'react';

// Reusable "+ Task" control. Drop it on any detail page with the entity context
// pre-filled (relatedType/relatedId/customerId/jobId) — see ADR-042.
export function TaskQuickAdd({
  assignees = [],
  kind = 'followup',
  relatedType,
  relatedId,
  customerId,
  jobId,
  presetTitle,
}: {
  assignees?: TaskAssignee[];
  kind?: TaskKind;
  relatedType?: TaskRelatedType;
  relatedId?: string;
  customerId?: string;
  jobId?: string;
  presetTitle?: string;
}) {
  const t = useTranslations('tasks');
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<TaskActionState, FormData>(
    async (prev, fd) => {
      const next = await createTask(prev, fd);
      if (next.status === 'ok') formRef.current?.reset();
      return next;
    },
    INITIAL_TASK_STATE,
  );

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-2 rounded-md border p-3">
      <input type="hidden" name="kind" value={kind} />
      {relatedType ? <input type="hidden" name="related_type" value={relatedType} /> : null}
      {relatedId ? <input type="hidden" name="related_id" value={relatedId} /> : null}
      {customerId ? <input type="hidden" name="customer_id" value={customerId} /> : null}
      {jobId ? <input type="hidden" name="job_id" value={jobId} /> : null}
      <div className="flex flex-wrap items-start gap-2">
        <input
          name="title"
          required
          maxLength={500}
          defaultValue={presetTitle ?? ''}
          placeholder={t('titlePlaceholder')}
          className="min-w-48 flex-1 rounded-md border px-3 py-2 text-sm"
        />
        <select name="priority" defaultValue="medium" aria-label={t('priority')} className="rounded-md border px-2 py-2 text-sm">
          <option value="low">{t('priorityLow')}</option>
          <option value="medium">{t('priorityMedium')}</option>
          <option value="high">{t('priorityHigh')}</option>
        </select>
        <input name="due_at" type="date" aria-label={t('due')} className="rounded-md border px-2 py-2 text-sm" />
        {assignees.length > 0 ? (
          <select name="assigned_to_ids" multiple aria-label={t('assignees')} className="rounded-md border px-2 py-2 text-sm">
            {assignees.map((a) => (
              <option key={a.id} value={a.id}>
                {a.full_name}
              </option>
            ))}
          </select>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="rounded-md border bg-[var(--color-primary)] px-3 py-2 text-xs font-medium text-[var(--color-primary-foreground)] disabled:opacity-50"
        >
          {pending ? '…' : t('add')}
        </button>
      </div>
      {state.status === 'error' ? <p className="text-xs text-red-600">{state.message}</p> : null}
    </form>
  );
}
