import { TaskQuickAdd } from '@/components/domain/task/task-quick-add';
import { TaskQueueRow } from '@/components/domain/task/task-row';
import { requireUser } from '@/lib/auth/require-role';
import { listMyTasks, listTaskAssignees } from '@/lib/queries/tasks';
import { isOverdue, sortQueue } from '@/lib/tasks/model';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<{ scope?: string; show?: string }> };

export default async function TasksPage({ searchParams }: Props) {
  const me = await requireUser();
  const { scope: scopeParam, show } = await searchParams;
  const scope = scopeParam === 'all' ? 'all' : 'mine';
  const onlyOpen = show !== 'all';
  const now = new Date();

  const [rows, assignees, t] = await Promise.all([
    listMyTasks({ userId: me.id, scope, onlyOpen }),
    listTaskAssignees(),
    getTranslations('tasks'),
  ]);
  const ordered = sortQueue(rows, now);

  const tab = (key: 'mine' | 'all', label: string) => {
    const active = scope === key;
    return (
      <Link
        href={`/dashboard/tasks?scope=${key}${onlyOpen ? '' : '&show=all'}`}
        className={
          active
            ? 'rounded-md bg-[var(--color-primary)] px-3 py-1.5 text-xs font-medium text-[var(--color-primary-foreground)]'
            : 'rounded-md border px-3 py-1.5 text-xs'
        }
      >
        {label}
      </Link>
    );
  };

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{t('subtitle')}</p>
      </header>

      <TaskQuickAdd assignees={assignees} />

      <div className="flex flex-wrap items-center gap-2">
        {tab('mine', t('scopeMine'))}
        {tab('all', t('scopeAll'))}
        <span className="mx-1 text-[var(--color-border)]">|</span>
        <Link
          href={`/dashboard/tasks?scope=${scope}${onlyOpen ? '&show=all' : ''}`}
          className="rounded-md border px-3 py-1.5 text-xs"
        >
          {onlyOpen ? t('showAll') : t('showOpen')}
        </Link>
      </div>

      {ordered.length === 0 ? (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-[var(--color-muted-foreground)]">
          {t('empty')}
        </p>
      ) : (
        <ul className="divide-y rounded-md border">
          {ordered.map((task) => (
            <TaskQueueRow key={task.id} task={task} overdue={isOverdue(task, now)} />
          ))}
        </ul>
      )}
    </main>
  );
}
