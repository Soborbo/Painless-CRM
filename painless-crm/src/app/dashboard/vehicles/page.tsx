import { requireRole } from '@/lib/auth/require-role';
import { listVehicles } from '@/lib/queries/vehicles';
import { VEHICLE_PAGE_SIZE, VehicleListFiltersSchema } from '@/lib/schemas/vehicle';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { VehicleTable } from './vehicle-table';

type Props = {
  searchParams: Promise<{ type?: string; active?: string; page?: string }>;
};

export default async function VehiclesPage({ searchParams }: Props) {
  await requireRole(['manager', 'admin', 'super_admin']);
  const params = await searchParams;
  const filters = VehicleListFiltersSchema.parse({
    type: params.type,
    active: params.active,
    page: params.page,
  });

  const result = await listVehicles(filters);
  const t = await getTranslations('vehicles');
  const lastPage = Math.max(1, Math.ceil(result.total / VEHICLE_PAGE_SIZE));

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
            {t('totalCount', { count: result.total })}
          </p>
        </div>
        <Link
          href="/dashboard/vehicles/new"
          className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-foreground)] transition-opacity hover:opacity-90"
        >
          {t('newVehicle')}
        </Link>
      </header>

      <ActiveFilter current={filters.active} />

      <VehicleTable rows={result.rows} />

      <Pagination
        page={filters.page}
        lastPage={lastPage}
        type={filters.type}
        active={filters.active}
      />
    </main>
  );
}

async function ActiveFilter({ current }: { current: string }) {
  const t = await getTranslations('vehicles');
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
          href={`/dashboard/vehicles?active=${tab.key}`}
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
  type,
  active,
}: {
  page: number;
  lastPage: number;
  type?: string;
  active: string;
}) {
  if (lastPage <= 1) return null;
  const link = (n: number) => {
    const p = new URLSearchParams();
    if (type) p.set('type', type);
    p.set('active', active);
    p.set('page', String(n));
    return `/dashboard/vehicles?${p.toString()}`;
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
