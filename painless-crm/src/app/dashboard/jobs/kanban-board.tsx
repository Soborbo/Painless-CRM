import { JOB_STAGES, type JobStage } from '@/lib/jobs/state-machine';
import type { JobListRow } from '@/lib/queries/jobs';
import { getTranslations } from 'next-intl/server';
import { KanbanCard } from './kanban-card';

const COLLAPSED_BY_DEFAULT: JobStage[] = ['declined', 'dead', 'cancelled'];
const KANBAN_ORDER: JobStage[] = [
  'lead',
  'contacted',
  'survey_scheduled',
  'quoted',
  'accepted',
  'confirmed',
  'in_progress',
  'completed',
  'invoiced',
  'paid',
  'declined',
  'dead',
  'cancelled',
];

export async function KanbanBoard({ rows }: { rows: JobListRow[] }) {
  const t = await getTranslations('jobs');

  if (rows.length === 0) {
    return (
      <p className="rounded-md border bg-[var(--color-muted)]/40 px-4 py-10 text-center text-sm text-[var(--color-muted-foreground)]">
        {t('emptyList')}
      </p>
    );
  }

  const grouped = new Map<JobStage, JobListRow[]>();
  for (const stage of JOB_STAGES) grouped.set(stage, []);
  for (const row of rows) grouped.get(row.stage)?.push(row);

  return (
    <div className="grid auto-cols-[minmax(260px,1fr)] grid-flow-col gap-3 overflow-x-auto pb-2">
      {KANBAN_ORDER.map((stage) => {
        const items = grouped.get(stage) ?? [];
        const collapsed = COLLAPSED_BY_DEFAULT.includes(stage) && items.length === 0;
        if (collapsed) return null;
        return (
          <section
            key={stage}
            className="flex min-w-[260px] flex-col rounded-md border bg-[var(--color-muted)]/30"
          >
            <header className="flex items-center justify-between border-b px-3 py-2 text-xs font-medium uppercase tracking-wide">
              <span>{t(`stages.${stage}`)}</span>
              <span className="text-[var(--color-muted-foreground)]">{items.length}</span>
            </header>
            <ol className="flex flex-col gap-2 p-2">
              {items.length === 0 ? (
                <li className="rounded-md border border-dashed border-[var(--color-muted)] px-2 py-3 text-center text-xs text-[var(--color-muted-foreground)]">
                  —
                </li>
              ) : (
                items.map((row) => (
                  <li key={row.id}>
                    <KanbanCard row={row} />
                  </li>
                ))
              )}
            </ol>
          </section>
        );
      })}
    </div>
  );
}
