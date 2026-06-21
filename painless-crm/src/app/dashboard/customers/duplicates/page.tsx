import { requireRole } from '@/lib/auth/require-role';
import { type MatchSignal, findDuplicateClusters } from '@/lib/customers/duplicates';
import { DEDUP_SCAN_MAX, listCustomersForDedup } from '@/lib/queries/customers';
import { customerDisplayName, formatDate } from '@/lib/utils/format';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { MergeClusterForm } from './merge-cluster-form';

const ROLES = ['sales', 'manager', 'admin', 'super_admin'] as const;
const MERGE_ROLES: readonly string[] = ['manager', 'admin', 'super_admin'];

export const dynamic = 'force-dynamic';

export default async function CustomerDuplicatesPage() {
  const me = await requireRole(ROLES);
  const [customers, t] = await Promise.all([listCustomersForDedup(), getTranslations('customers')]);
  const clusters = findDuplicateClusters(customers);
  const canMerge = MERGE_ROLES.includes(me.role);

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-10">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            <Link href="/dashboard/customers" className="hover:underline">
              ← {t('title')}
            </Link>
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{t('duplicatesTitle')}</h1>
          <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
            {t('duplicatesSubtitle')}
          </p>
        </div>
        <span className="rounded-md border px-3 py-1.5 text-sm text-[var(--color-muted-foreground)]">
          {t('duplicatesCount', { count: clusters.length })}
        </span>
      </header>

      {clusters.length === 0 ? (
        <p className="rounded-md border border-dashed px-4 py-12 text-center text-sm text-[var(--color-muted-foreground)]">
          {t('duplicatesNone')}
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {clusters.map((cluster) => (
            <section key={cluster.id} className="rounded-md border">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-[var(--color-muted)]/40 px-4 py-2">
                <span className="text-sm font-medium">
                  {t('duplicatesRecords', { count: cluster.customers.length })}
                </span>
                <span className="flex gap-1.5">
                  {cluster.matchedOn.map((signal) => (
                    <span
                      key={signal}
                      className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900"
                    >
                      {t(matchLabelKey(signal))}
                    </span>
                  ))}
                </span>
              </div>
              <ul className="divide-y">
                {cluster.customers.map((c) => (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/dashboard/customers/${c.id}`}
                        className="font-medium hover:underline"
                      >
                        {customerDisplayName(c)}
                      </Link>
                      <p className="text-xs text-[var(--color-muted-foreground)]">
                        {[c.primary_email, c.primary_phone].filter(Boolean).join(' · ') || '—'}
                      </p>
                    </div>
                    <span className="text-xs text-[var(--color-muted-foreground)]">
                      {t('duplicatesJoined', { date: formatDate(c.created_at) })}
                    </span>
                  </li>
                ))}
              </ul>
              {canMerge ? (
                <MergeClusterForm
                  members={cluster.customers.map((c) => ({
                    id: c.id,
                    name: customerDisplayName(c),
                  }))}
                />
              ) : null}
            </section>
          ))}
        </div>
      )}

      {customers.length >= DEDUP_SCAN_MAX ? (
        <p className="text-xs text-[var(--color-muted-foreground)]">
          {t('duplicatesScanNote', { max: DEDUP_SCAN_MAX })}
        </p>
      ) : null}
    </main>
  );
}

function matchLabelKey(signal: MatchSignal): 'duplicatesMatchEmail' | 'duplicatesMatchPhone' {
  return signal === 'email' ? 'duplicatesMatchEmail' : 'duplicatesMatchPhone';
}
