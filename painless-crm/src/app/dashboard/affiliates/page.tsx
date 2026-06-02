import { requireRole } from '@/lib/auth/require-role';
import { listAffiliates } from '@/lib/queries/affiliates';
import { AFFILIATE_PAGE_SIZE, AffiliateListFiltersSchema } from '@/lib/schemas/affiliate';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

const MANAGE_ROLES = ['manager', 'admin', 'super_admin'] as const;

type Props = { searchParams: Promise<{ status?: string; page?: string }> };

export default async function AffiliatesPage({ searchParams }: Props) {
  await requireRole(MANAGE_ROLES);
  const params = await searchParams;
  const filters = AffiliateListFiltersSchema.parse({ status: params.status, page: params.page });

  const result = await listAffiliates(filters);
  const t = await getTranslations('affiliates');
  const lastPage = Math.max(1, Math.ceil(result.total / AFFILIATE_PAGE_SIZE));

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
          href="/dashboard/affiliates/new"
          className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-foreground)] transition-opacity hover:opacity-90"
        >
          {t('newAffiliate')}
        </Link>
      </header>

      <nav className="flex gap-2 text-sm">
        {(['all', 'active', 'pending'] as const).map((s) => (
          <Link
            key={s}
            href={`/dashboard/affiliates?status=${s}`}
            className={`rounded-md px-3 py-1.5 ${
              filters.status === s
                ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
                : 'border hover:bg-[var(--color-muted)]'
            }`}
          >
            {t(`filter.${s}`)}
          </Link>
        ))}
      </nav>

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
                <th className="px-3 py-2 font-medium">{t('columns.type')}</th>
                <th className="px-3 py-2 font-medium">{t('columns.contact')}</th>
                <th className="px-3 py-2 font-medium">{t('columns.status')}</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((a) => (
                <tr key={a.id} className="border-t hover:bg-[var(--color-muted)]/40">
                  <td className="px-3 py-2 font-medium">
                    <Link href={`/dashboard/affiliates/${a.id}`} className="hover:underline">
                      {a.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{a.type ? t(`types.${a.type}`) : '—'}</td>
                  <td className="px-3 py-2">{a.contact_email ?? a.contact_name ?? '—'}</td>
                  <td className="px-3 py-2">
                    {a.active ? (
                      <span className="text-[var(--color-success,#16a34a)]">{t('statusActive')}</span>
                    ) : (
                      <span className="text-[var(--color-muted-foreground)]">{t('statusPending')}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {lastPage > 1 ? (
        <nav className="flex items-center justify-center gap-3 text-sm">
          {filters.page > 1 ? (
            <Link
              href={`/dashboard/affiliates?status=${filters.status}&page=${filters.page - 1}`}
              className="rounded-md border px-3 py-1.5 hover:bg-[var(--color-muted)]"
            >
              ← Prev
            </Link>
          ) : null}
          <span className="text-[var(--color-muted-foreground)]">
            {filters.page} / {lastPage}
          </span>
          {filters.page < lastPage ? (
            <Link
              href={`/dashboard/affiliates?status=${filters.status}&page=${filters.page + 1}`}
              className="rounded-md border px-3 py-1.5 hover:bg-[var(--color-muted)]"
            >
              Next →
            </Link>
          ) : null}
        </nav>
      ) : null}
    </main>
  );
}
