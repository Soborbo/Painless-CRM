import { listTasksForEntity, type TaskAssignee } from '@/lib/queries/tasks';
import { isOverdue, sortQueue, type TaskKind, type TaskRelatedType } from '@/lib/tasks/model';
import { getTranslations } from 'next-intl/server';
import { TaskQuickAdd } from './task-quick-add';
import { TaskQueueRow } from './task-row';

// Phase 27 follow-up (ADR-042) — drop-in Tasks panel for any entity detail page.
// Lists the entity's tasks and a pre-filled quick-add.
export async function TasksEntityPanel({
  relatedType,
  relatedId,
  customerId,
  jobId,
  assignees,
  kind = 'followup',
  presetTitle,
}: {
  relatedType: TaskRelatedType;
  relatedId: string;
  customerId?: string;
  jobId?: string;
  assignees?: TaskAssignee[];
  kind?: TaskKind;
  presetTitle?: string;
}) {
  const [rows, t] = await Promise.all([
    listTasksForEntity(relatedType, relatedId),
    getTranslations('tasks'),
  ]);
  const now = new Date();
  const ordered = sortQueue(rows, now);

  return (
    <div className="rounded-md border p-4">
      <h3 className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
        {t('panelTitle')}
      </h3>
      <div className="mt-3 flex flex-col gap-3">
        <TaskQuickAdd
          assignees={assignees}
          kind={kind}
          relatedType={relatedType}
          relatedId={relatedId}
          customerId={customerId}
          jobId={jobId}
          presetTitle={presetTitle}
        />
        {ordered.length === 0 ? (
          <p className="text-sm text-[var(--color-muted-foreground)]">{t('empty')}</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {ordered.map((task) => (
              <TaskQueueRow key={task.id} task={task} overdue={isOverdue(task, now)} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
