'use client';

import {
  INITIAL_JOB_TASK_STATE,
  type JobTaskActionState,
  addJobTask,
} from '@/lib/actions/job-tasks';
import { useTranslations } from 'next-intl';
import { useActionState, useRef } from 'react';

export function AddTaskForm({
  jobId,
  assignees = [],
}: {
  jobId: string;
  assignees?: Array<{ id: string; full_name: string }>;
}) {
  const t = useTranslations('jobTasks');
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<JobTaskActionState, FormData>(
    async (prev, fd) => {
      const next = await addJobTask(prev, fd);
      if (next.status === 'ok') formRef.current?.reset();
      return next;
    },
    INITIAL_JOB_TASK_STATE,
  );

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-2">
      <input type="hidden" name="job_id" value={jobId} />
      <div className="flex flex-wrap gap-2">
        <input
          name="title"
          required
          maxLength={500}
          placeholder={t('placeholder')}
          className="min-w-40 flex-1 rounded-md border px-3 py-2 text-sm"
        />
        <input
          name="due_date"
          type="date"
          aria-label={t('dueDate')}
          className="rounded-md border px-2 py-2 text-sm"
        />
        {assignees.length > 0 ? (
          <select
            name="assigned_to_id"
            defaultValue=""
            aria-label={t('assignee')}
            className="rounded-md border px-2 py-2 text-sm"
          >
            <option value="">{t('unassigned')}</option>
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
          className="rounded-md border bg-[var(--color-primary)] px-3 py-1.5 text-xs font-medium text-[var(--color-primary-foreground)] disabled:opacity-50"
        >
          {pending ? '…' : t('add')}
        </button>
      </div>
      {state.status === 'error' ? <p className="text-xs text-red-600">{state.message}</p> : null}
    </form>
  );
}
