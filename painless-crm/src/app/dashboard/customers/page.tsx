import { listCustomers } from '@/lib/queries/customers';
import { CUSTOMER_PAGE_SIZE, CustomerListFiltersSchema } from '@/lib/schemas/customer';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { CustomerTable } from './customer-table';
import { CustomerSearchForm } from './search-form';

type Props = {
  searchParams: Promise<{
    q?: string;
    type?: string;
    created_from?: string;
    created_to?: string;
    page?: string;
  }>;
};

export default async function CustomersPage({ searchParams }: Props) {
  const params = await searchParams;
  const filters = CustomerListFiltersSchema.parse({
    q: params.q,
    type: params.type,
    created_from: params.created_from,
    created_to: params.created_to,
    page: params.page,
  });

  const result = await listCustomers(filters);
  const t = await getTranslations('customers');
  const lastPage = Math.max(1, Math.ceil(result.total / CUSTOMER_PAGE_SIZE));

  const exportParams = new URLSearchParams();
  if (filters.q) exportParams.set('q', filters.q);
  if (filters.type) exportParams.set('type', filters.type);
  if (filters.created_from) exportParams.set('created_from', filters.created_from);
  if (filters.created_to) exportParams.set('created_to', filters.created_to);
  const exportHref = `/dashboard/customers/export${exportParams.size ? `?${exportParams}` : ''}`;

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
            {t('totalCount', { count: result.total })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href={exportHref}
            className="rounded-md border px-3 py-2 text-sm hover:bg-[var(--color-muted)]"
          >
            {t('exportCsv')}
          </a>
          <Link
            href="/dashboard/customers/new"
            className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-foreground)] transition-opacity hover:opacity-90"
          >
            {t('newCustomer')}
          </Link>
        </div>
      </header>

      <CustomerSearchForm
        initialQuery={filters.q ?? ''}
        initialType={filters.type ?? 'all'}
        initialCreatedFrom={filters.created_from ?? ''}
        initialCreatedTo={filters.created_to ?? ''}
      />

      <CustomerTable rows={result.rows} />

      <Pagination
        page={filters.page}
        lastPage={lastPage}
        q={filters.q}
        type={filters.type}
        createdFrom={filters.created_from}
        createdTo={filters.created_to}
      />
    </main>
  );
}

function Pagination({
  page,
  lastPage,
  q,
  type,
  createdFrom,
  createdTo,
}: {
  page: number;
  lastPage: number;
  q?: string;
  type?: string;
  createdFrom?: string;
  createdTo?: string;
}) {
  if (lastPage <= 1) return null;
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (type) params.set('type', type);
  if (createdFrom) params.set('created_from', createdFrom);
  if (createdTo) params.set('created_to', createdTo);
  const link = (n: number) => {
    const p = new URLSearchParams(params);
    p.set('page', String(n));
    return `/dashboard/customers?${p.toString()}`;
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
