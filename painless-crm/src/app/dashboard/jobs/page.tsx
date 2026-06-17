import { requireUser } from '@/lib/auth/require-role';
import { JOB_STAGES } from '@/lib/jobs/state-machine';
import { listAddressesForJobs } from '@/lib/queries/job-addresses';
import { listJobs, listJobsForKanban, listSalesReps } from '@/lib/queries/jobs';
import { JOB_PAGE_SIZE, JobListFiltersSchema } from '@/lib/schemas/job';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { JobsFilters } from './jobs-filters';
import { JobsGrid } from './jobs-grid';
import { JobsTable } from './jobs-table';
import { type JobsView, JobsViewToggle } from './jobs-view-toggle';
import { KanbanBoard } from './kanban-board';
import { Pagination } from './pagination';

type Props = {
  searchParams: Promise<{
    q?: string;
    stage?: string;
    assigned_to_id?: string;
    move_from?: string;
    move_to?: string;
    page?: string;
    view?: string;
    sort?: string;
    dir?: string;
  }>;
};

export default async function JobsPage({ searchParams }: Props) {
  const params = await searchParams;
  const filters = JobListFiltersSchema.parse({
    q: params.q,
    stage: params.stage,
    assigned_to_id: params.assigned_to_id,
    move_from: params.move_from,
    move_to: params.move_to,
    page: params.page,
    sort: params.sort,
    dir: params.dir,
  });
  const view: JobsView =
    params.view === 'kanban' ? 'kanban' : params.view === 'list' ? 'list' : 'grid';

  const [reps, t] = await Promise.all([listSalesReps(), getTranslations('jobs')]);

  const exportParams = new URLSearchParams();
  if (filters.q) exportParams.set('q', filters.q);
  if (filters.stage) exportParams.set('stage', filters.stage);
  if (filters.assigned_to_id) exportParams.set('assigned_to_id', filters.assigned_to_id);
  if (filters.move_from) exportParams.set('move_from', filters.move_from);
  if (filters.move_to) exportParams.set('move_to', filters.move_to);
  const exportHref = `/dashboard/jobs/export${exportParams.size ? `?${exportParams}` : ''}`;

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-5 px-6 py-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="mt-0.5 text-sm text-[var(--color-muted-foreground)]">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <JobsViewToggle view={view} />
          <a
            href={exportHref}
            className="rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-[var(--color-muted)]"
          >
            {t('exportCsv')}
          </a>
          <Link
            href="/dashboard/jobs/new"
            className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-foreground)] shadow-sm transition-all duration-150 hover:opacity-90 hover:shadow motion-safe:active:scale-95"
          >
            + {t('newJob')}
          </Link>
        </div>
      </header>

      <JobsFilters
        initialQ={filters.q ?? ''}
        initialStage={filters.stage ?? 'all'}
        initialAssignedTo={filters.assigned_to_id ?? 'all'}
        initialMoveFrom={filters.move_from ?? ''}
        initialMoveTo={filters.move_to ?? ''}
        stages={[...JOB_STAGES]}
        reps={reps.map((r) => ({ id: r.id, full_name: r.full_name }))}
      />

      {view === 'kanban' ? (
        <KanbanView filters={filters} />
      ) : (
        <PagedView filters={filters} view={view} />
      )}
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
    move_from: filters.move_from,
    move_to: filters.move_to,
  });
  return <KanbanBoard rows={rows} />;
}

async function PagedView({
  filters,
  view,
}: {
  filters: ReturnType<typeof JobListFiltersSchema.parse>;
  view: 'grid' | 'list';
}) {
  const [result, me, t] = await Promise.all([
    listJobs(filters),
    requireUser(),
    getTranslations('jobs'),
  ]);
  const lastPage = Math.max(1, Math.ceil(result.total / JOB_PAGE_SIZE));
  const isAdmin = me.role === 'admin' || me.role === 'super_admin';
  const addresses = view === 'grid' ? await listAddressesForJobs(result.rows.map((r) => r.id)) : {};

  return (
    <>
      <p className="text-sm text-[var(--color-muted-foreground)]">
        {t('totalCount', { count: result.total })}
      </p>
      {view === 'grid' ? (
        <JobsGrid rows={result.rows} addresses={addresses} isAdmin={isAdmin} />
      ) : (
        <JobsTable
          rows={result.rows}
          sort={filters.sort}
          dir={filters.dir}
          params={{
            q: filters.q,
            stage: filters.stage,
            assigned_to_id: filters.assigned_to_id,
            move_from: filters.move_from ?? undefined,
            move_to: filters.move_to ?? undefined,
            view,
          }}
        />
      )}
      <Pagination
        page={filters.page}
        lastPage={lastPage}
        q={filters.q}
        stage={filters.stage}
        assignedTo={filters.assigned_to_id}
        moveFrom={filters.move_from}
        moveTo={filters.move_to}
        view={view}
        sort={filters.sort}
        dir={filters.dir}
      />
    </>
  );
}
