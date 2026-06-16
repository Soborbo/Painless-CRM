'use client';

import { INITIAL_TASK_STATE, completeTask, deleteTask } from '@/lib/actions/tasks';
import type { TaskRow } from '@/lib/queries/tasks';
import { formatDate } from '@/lib/utils/format';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

export function TaskItem({ task }: { task: TaskRow }) {
  const t = useTranslations('jobTasks');
  const [, toggle] = useActionState(completeTask, INITIAL_TASK_STATE);
  const [, remove, removing] = useActionState(deleteTask, INITIAL_TASK_STATE);
  const done = task.status === 'done';

  return (
    <li className="flex items-center gap-2 py-2 first:pt-0 last:pb-0">
      <form action={toggle} className="flex items-center">
        <input type="hidden" name="id" value={task.id} />
        <input
          type="checkbox"
          name="done"
          defaultChecked={done}
          aria-label={task.title}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
          className="h-4 w-4"
        />
      </form>

      <span
        className={
          done
            ? 'flex-1 text-sm text-[var(--color-muted-foreground)] line-through'
            : 'flex-1 text-sm'
        }
      >
        {task.title}
      </span>

      {task.due_at ? (
        <span className="text-[11px] text-[var(--color-muted-foreground)]">
          {formatDate(task.due_at)}
        </span>
      ) : null}
      {task.assignees.length > 0 ? (
        <span className="text-[11px] font-medium">
          {task.assignees.map((a) => a.full_name).join(', ')}
        </span>
      ) : null}

      <form action={remove}>
        <input type="hidden" name="id" value={task.id} />
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
