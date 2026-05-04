import { JOB_STAGES } from '@/lib/jobs/state-machine';
import { listJobs, listJobsForKanban, listSalesReps } from '@/lib/queries/jobs';
import { JOB_PAGE_SIZE, JobListFiltersSchema } from '@/lib/schemas/job';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { JobsFilters } from './jobs-filters';
import { JobsTable } from './jobs-table';
import { JobsViewToggle } from './jobs-view-toggle';
import { KanbanBoard } from './kanban-board';

type Props = {
  searchParams: Promise<{
    q?: string;
    stage?: string;
    assigned_to_id?: string;
    page?: string;
    view?: string;
  }>;
};

export default async function JobsPage({ searchParams }: Props) {
  const params = await searchParams;
  const filters = JobListFiltersSchema.parse({
    q: params.q,
    stage: params.stage,
    assigned_to_id: params.assigned_to_id,
    page: params.page,
  });
  const view: 'list' | 'kanban' = params.view === 'kanban' ? 'kanban' : 'list';

  const [reps, t] = await Promise.all([listSalesReps(), getTranslations('jobs')]);

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        </div>
        <div className="flex items-center gap-3">
          <JobsViewToggle view={view} />
          <Link
            href="/dashboard/jobs/new"
            className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-foreground)] transition-opacity hover:opacity-90"
          >
            {t('newJob')}
          </Link>
        </div>
      </header>

      <JobsFilters
        initialQ={filters.q ?? ''}
        initialStage={filters.stage ?? 'all'}
        initialAssignedTo={filters.assigned_to_id ?? 'all'}
        stages={[...JOB_STAGES]}
        reps={reps.map((r) => ({ id: r.id, full_name: r.full_name }))}
      />

      {view === 'kanban' ? <KanbanView filters={filters} /> : <ListView filters={filters} />}
    </main>
  );
}

async function KanbanView({
  filters,
}: {
  filters: ReturnType<typeof JobListFiltersSchema.parse>;
}) {
  const rows = await listJobsForKanban({
    q: filters.q,
    assigned_to_id: filters.assigned_to_id,
  });
  return <KanbanBoard rows={rows} />;
}

async function ListView({
  filters,
}: {
  filters: ReturnType<typeof JobListFiltersSchema.parse>;
}) {
  const result = await listJobs(filters);
  const lastPage = Math.max(1, Math.ceil(result.total / JOB_PAGE_SIZE));
  const t = await getTranslations('jobs');

  return (
    <>
      <p className="text-sm text-[var(--color-muted-foreground)]">
        {t('totalCount', { count: result.total })}
      </p>
      <JobsTable rows={result.rows} />
      <Pagination
        page={filters.page}
        lastPage={lastPage}
        q={filters.q}
        stage={filters.stage}
        assignedTo={filters.assigned_to_id}
      />
    </>
  );
}

function Pagination({
  page,
  lastPage,
  q,
  stage,
  assignedTo,
}: {
  page: number;
  lastPage: number;
  q?: string;
  stage?: string;
  assignedTo?: string;
}) {
  if (lastPage <= 1) return null;
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (stage) params.set('stage', stage);
  if (assignedTo) params.set('assigned_to_id', assignedTo);
  const link = (n: number) => {
    const p = new URLSearchParams(params);
    p.set('page', String(n));
    return `/dashboard/jobs?${p.toString()}`;
  };

  return (
    <nav className="flex items-center justify-center gap-3 text-sm">
      {page > 1 ? (
        <Link
          href={link(page - 1)}
          className="rounded-md border px-3 py-1.5 hover:bg-[var(--color-muted)]"
        >
          ← Prev
        </Link>
      ) : (
        <span className="rounded-md border px-3 py-1.5 opacity-40">← Prev</span>
      )}
      <span className="text-[var(--color-muted-foreground)]">
        {page} / {lastPage}
      </span>
      {page < lastPage ? (
        <Link
          href={link(page + 1)}
          className="rounded-md border px-3 py-1.5 hover:bg-[var(--color-muted)]"
        >
          Next →
        </Link>
      ) : (
        <span className="rounded-md border px-3 py-1.5 opacity-40">Next →</span>
      )}
    </nav>
  );
}
