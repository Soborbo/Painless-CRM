'use client';

import {
  INITIAL_JOB_TASK_STATE,
  deleteJobTask,
  toggleJobTask,
} from '@/lib/actions/job-tasks';
import type { JobTaskRow } from '@/lib/queries/job-tasks';
import { formatDate } from '@/lib/utils/format';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

export function TaskItem({ task, jobId }: { task: JobTaskRow; jobId: string }) {
  const t = useTranslations('jobTasks');
  const [, toggle] = useActionState(toggleJobTask, INITIAL_JOB_TASK_STATE);
  const [, remove, removing] = useActionState(deleteJobTask, INITIAL_JOB_TASK_STATE);

  return (
    <li className="flex items-center gap-2 py-2 first:pt-0 last:pb-0">
      <form action={toggle} className="flex items-center">
        <input type="hidden" name="id" value={task.id} />
        <input type="hidden" name="job_id" value={jobId} />
        <input
          type="checkbox"
          name="done"
          defaultChecked={task.done}
          aria-label={task.title}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
          className="h-4 w-4"
        />
      </form>

      <span
        className={
          task.done
            ? 'flex-1 text-sm text-[var(--color-muted-foreground)] line-through'
            : 'flex-1 text-sm'
        }
      >
        {task.title}
      </span>

      {task.due_date ? (
        <span className="text-[11px] text-[var(--color-muted-foreground)]">
          {formatDate(task.due_date)}
        </span>
      ) : null}
      {task.assigned_to ? (
        <span className="text-[11px] font-medium">{task.assigned_to.full_name}</span>
      ) : null}

      <form action={remove}>
        <input type="hidden" name="id" value={task.id} />
        <input type="hidden" name="job_id" value={jobId} />
        <button
          type="submit"
          disabled={removing}
          className="text-[11px] text-[var(--color-muted-foreground)] hover:text-red-600 disabled:opacity-50"
        >
          {t('delete')}
        </button>
      </form>
    </li>
  );
}
