import { type QuoteListItem, classifyQuoteValidity, listQuotes } from '@/lib/queries/quotes';
import { QUOTE_PAGE_SIZE, QUOTE_STATUSES, QuoteListFiltersSchema } from '@/lib/schemas/quote';
import { customerDisplayName, formatDate, formatPence } from '@/lib/utils/format';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { QuotesFilters } from './quotes-filters';

export const dynamic = 'force-dynamic';

type Props = {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
};

export default async function QuotesPage({ searchParams }: Props) {
  const params = await searchParams;
  const filters = QuoteListFiltersSchema.parse({
    q: params.q,
    status: params.status,
    page: params.page,
  });

  const [result, t] = await Promise.all([listQuotes(filters), getTranslations('quotes')]);
  const lastPage = Math.max(1, Math.ceil(result.total / QUOTE_PAGE_SIZE));
  const now = new Date();

  const exportParams = new URLSearchParams();
  if (filters.q) exportParams.set('q', filters.q);
  if (filters.status) exportParams.set('status', filters.status);
  const exportHref = `/dashboard/quotes/export${exportParams.size ? `?${exportParams}` : ''}`;

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">{t('list.title')}</h1>
        <a
          href={exportHref}
          className="rounded-md border px-3 py-2 text-sm hover:bg-[var(--color-muted)]"
        >
          {t('list.exportCsv')}
        </a>
      </header>

      <QuotesFilters
        initialQ={filters.q ?? ''}
        initialStatus={filters.status ?? 'all'}
        statuses={[...QUOTE_STATUSES]}
      />

      <p className="text-sm text-[var(--color-muted-foreground)]">
        {t('list.totalCount', { count: result.total })}
      </p>

      {result.rows.length === 0 ? (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-[var(--color-muted-foreground)]">
          {t('list.empty')}
        </p>
      ) : (
        <section className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-[var(--color-muted-foreground)]">
              <tr>
                <th className="px-4 py-2">{t('list.columns.job')}</th>
                <th className="px-4 py-2">{t('list.columns.customer')}</th>
                <th className="px-4 py-2">{t('list.columns.status')}</th>
                <th className="px-4 py-2 text-right">{t('list.columns.total')}</th>
                <th className="px-4 py-2">{t('list.columns.validUntil')}</th>
                <th className="px-4 py-2">{t('list.columns.created')}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {result.rows.map((row) => (
                <QuoteRow key={row.id} row={row} now={now} t={t} />
              ))}
            </tbody>
          </table>
        </section>
      )}

      <Pagination page={filters.page} lastPage={lastPage} q={filters.q} status={filters.status} />
    </main>
  );
}

function QuoteRow({
  row,
  now,
  t,
}: {
  row: QuoteListItem;
  now: Date;
  t: Awaited<ReturnType<typeof getTranslations<'quotes'>>>;
}) {
  const validity = classifyQuoteValidity(row.valid_until, now);
  const validityTone =
    validity === 'expired'
      ? 'text-red-700'
      : validity === 'expiring_soon'
        ? 'text-yellow-800'
        : 'text-[var(--color-muted-foreground)]';
  return (
    <tr>
      <td className="px-4 py-2">
        <Link
          href={`/dashboard/jobs/${row.job_id}/quote/${row.id}`}
          className="font-mono hover:underline"
        >
          {row.job_number}
        </Link>
        {row.revision_number > 1 ? (
          <span className="ml-2 text-xs text-[var(--color-muted-foreground)]">
            {t('revisionBadge', { number: row.revision_number })}
          </span>
        ) : null}
      </td>
      <td className="px-4 py-2">{row.customer ? customerDisplayName(row.customer) : '—'}</td>
      <td className="px-4 py-2">{row.status ? t(`status.${row.status}` as never) : '—'}</td>
      <td className="px-4 py-2 text-right tabular-nums">{formatPence(row.total_pence)}</td>
      <td className={`px-4 py-2 ${validityTone}`}>{formatDate(row.valid_until)}</td>
      <td className="px-4 py-2 text-[var(--color-muted-foreground)]">
        {formatDate(row.created_at)}
      </td>
    </tr>
  );
}

function Pagination({
  page,
  lastPage,
  q,
  status,
}: {
  page: number;
  lastPage: number;
  q?: string;
  status?: string;
}) {
  if (lastPage <= 1) return null;
  const link = (n: number) => {
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    if (status) p.set('status', status);
    p.set('page', String(n));
    return `/dashboard/quotes?${p.toString()}`;
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
