import { requireRole } from '@/lib/auth/require-role';
import { listWorkers } from '@/lib/queries/workers';
import { WORKER_PAGE_SIZE, WorkerListFiltersSchema } from '@/lib/schemas/worker';
import { formatPence } from '@/lib/utils/format';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

type Props = { searchParams: Promise<{ active?: string; page?: string }> };

export default async function WorkersPage({ searchParams }: Props) {
  await requireRole(['manager', 'admin', 'super_admin']);
  const params = await searchParams;
  const filters = WorkerListFiltersSchema.parse({ active: params.active, page: params.page });

  const result = await listWorkers(filters);
  const t = await getTranslations('workers');
  const lastPage = Math.max(1, Math.ceil(result.total / WORKER_PAGE_SIZE));

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
            {t('totalCount', { count: result.total })}
          </p>
        </div>
        <Link
          href="/dashboard/workers/new"
          className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-foreground)] transition-opacity hover:opacity-90"
        >
          {t('newWorker')}
        </Link>
      </header>

      <ActiveFilter current={filters.active} />

      {result.rows.length === 0 ? (
        <p className="rounded-md border bg-[var(--color-muted)]/40 px-4 py-10 text-center text-sm text-[var(--color-muted-foreground)]">
          {t('emptyList')}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--color-muted)]">
              <tr>
                <th className="px-3 py-2 font-medium">{t('columns.name')}</th>
                <th className="px-3 py-2 font-medium">{t('columns.phone')}</th>
                <th className="px-3 py-2 font-medium">{t('columns.email')}</th>
                <th className="px-3 py-2 font-medium">{t('columns.hourlyRate')}</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((w) => (
                <tr key={w.id} className="border-t hover:bg-[var(--color-muted)]/40">
                  <td className="px-3 py-2 font-medium">
                    <Link href={`/dashboard/workers/${w.id}`} className="hover:underline">
                      {w.full_name}
                    </Link>
                    {!w.active ? (
                      <span className="ml-2 text-xs text-[var(--color-muted-foreground)]">
                        ({t('inactiveBadge')})
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">{w.phone ?? '—'}</td>
                  <td className="px-3 py-2">{w.email ?? '—'}</td>
                  <td className="px-3 py-2">
                    {w.hourly_rate_pence != null ? `${formatPence(w.hourly_rate_pence)}/hr` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={filters.page} lastPage={lastPage} active={filters.active} />
    </main>
  );
}

async function ActiveFilter({ current }: { current: string }) {
  const t = await getTranslations('workers');
  const tabs: { key: 'active' | 'all' | 'inactive'; label: string }[] = [
    { key: 'active', label: t('filterActive') },
    { key: 'inactive', label: t('filterInactive') },
    { key: 'all', label: t('filterAll') },
  ];
  return (
    <nav className="flex gap-2 text-sm">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={`/dashboard/workers?active=${tab.key}`}
          className={`rounded-md px-3 py-1.5 ${
            current === tab.key
              ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
              : 'border hover:bg-[var(--color-muted)]'
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

function Pagination({
  page,
  lastPage,
  active,
}: { page: number; lastPage: number; active: string }) {
  if (lastPage <= 1) return null;
  const link = (n: number) => `/dashboard/workers?active=${active}&page=${n}`;
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
