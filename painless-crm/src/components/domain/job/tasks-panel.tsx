import { completeness } from '@/lib/jobs/tasks';
import type { JobTaskRow } from '@/lib/queries/job-tasks';
import { getTranslations } from 'next-intl/server';
import { AddTaskForm } from './add-task-form';
import { TaskItem } from './task-item';

interface Props {
  jobId: string;
  rows: JobTaskRow[];
}

export async function TasksPanel({ jobId, rows }: Props) {
  const t = await getTranslations('jobTasks');
  const stats = completeness(rows);

  return (
    <div className="rounded-md border p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
          {t('panelTitle')}
        </h3>
        {stats.total > 0 ? (
          <span className="text-xs text-[var(--color-muted-foreground)]">
            {t('progress', { done: stats.done, total: stats.total, percent: stats.percent })}
          </span>
        ) : null}
      </div>
      <div className="mt-3 flex flex-col gap-3 text-sm">
        <AddTaskForm jobId={jobId} />
        {rows.length === 0 ? (
          <p className="text-sm text-[var(--color-muted-foreground)]">{t('empty')}</p>
        ) : (
          <ul className="flex flex-col divide-y">
            {rows.map((task) => (
              <TaskItem key={task.id} task={task} jobId={jobId} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
