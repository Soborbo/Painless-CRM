'use client';

import { INITIAL_TASK_STATE, completeTask, deleteTask } from '@/lib/actions/tasks';
import type { TaskRow } from '@/lib/queries/tasks';
import type { TaskRelatedType } from '@/lib/tasks/model';
import { formatDate } from '@/lib/utils/format';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useActionState } from 'react';

const RELATED_PATH: Record<TaskRelatedType, string> = {
  customer: '/dashboard/customers',
  job: '/dashboard/jobs',
  quote: '/dashboard/quotes',
  complaint: '/dashboard/complaints',
  phone_call: '/dashboard/calls',
};

function relatedHref(task: TaskRow): string | null {
  if (task.related_type && task.related_id) {
    return `${RELATED_PATH[task.related_type]}/${task.related_id}`;
  }
  if (task.job_id) return `/dashboard/jobs/${task.job_id}`;
  if (task.customer_id) return `/dashboard/customers/${task.customer_id}`;
  return null;
}

const PRIORITY_CLASS: Record<string, string> = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-slate-100 text-slate-600',
};

export function TaskQueueRow({ task, overdue }: { task: TaskRow; overdue: boolean }) {
  const t = useTranslations('tasks');
  const [, toggle] = useActionState(completeTask, INITIAL_TASK_STATE);
  const [, remove, removing] = useActionState(deleteTask, INITIAL_TASK_STATE);
  const done = task.status === 'done';
  const href = relatedHref(task);

  return (
    <li className="flex items-center gap-3 px-4 py-2.5">
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

      <div className="min-w-0 flex-1">
        <p className={done ? 'truncate text-sm line-through text-[var(--color-muted-foreground)]' : 'truncate text-sm'}>
          {task.title}
        </p>
        {task.assignees.length > 0 ? (
          <p className="truncate text-[11px] text-[var(--color-muted-foreground)]">
            {task.assignees.map((a) => a.full_name).join(', ')}
          </p>
        ) : null}
      </div>

      <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${PRIORITY_CLASS[task.priority]}`}>
        {t(`priority${task.priority === 'high' ? 'High' : task.priority === 'low' ? 'Low' : 'Medium'}`)}
      </span>

      {task.due_at ? (
        <span className={`whitespace-nowrap text-[11px] tabular-nums ${overdue ? 'font-medium text-red-700' : 'text-[var(--color-muted-foreground)]'}`}>
          {formatDate(task.due_at)}
        </span>
      ) : null}

      {href ? (
        <Link href={href} className="text-[11px] text-[var(--color-primary)] hover:underline">
          {t('open')}
        </Link>
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
