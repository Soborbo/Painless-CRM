import { requireRole } from '@/lib/auth/require-role';
import { listCommissions } from '@/lib/queries/commissions';
import { formatPence } from '@/lib/utils/format';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

import { PayoutsTable } from './payouts-table';

const BILLING_ROLES = ['accounts', 'manager', 'admin', 'super_admin'] as const;
const STATUSES = ['all', 'pending', 'approved', 'paid', 'cancelled'] as const;

export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<{ status?: string }> };

export default async function PayoutsPage({ searchParams }: Props) {
  await requireRole(BILLING_ROLES);
  const { status: statusParam } = await searchParams;
  const status = (STATUSES as readonly string[]).includes(statusParam ?? '')
    ? (statusParam as string)
    : 'all';

  const { rows, totalsByStatus } = await listCommissions(status === 'all' ? undefined : status);
  const t = await getTranslations('payouts');

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-10">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{t('intro')}</p>
        </div>
        <Link
          href="/dashboard/affiliates"
          className="rounded-md border px-3 py-1.5 text-sm hover:bg-[var(--color-muted)]"
        >
          {t('backToAffiliates')}
        </Link>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <SummaryTile
          label={t('statuses.pending')}
          value={formatPence(totalsByStatus.pending ?? 0)}
        />
        <SummaryTile
          label={t('statuses.approved')}
          value={formatPence(totalsByStatus.approved ?? 0)}
        />
        <SummaryTile label={t('statuses.paid')} value={formatPence(totalsByStatus.paid ?? 0)} />
      </section>

      <nav className="flex flex-wrap gap-2 text-sm">
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/dashboard/affiliates/payouts?status=${s}`}
            className={`rounded-md px-3 py-1.5 ${
              status === s
                ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
                : 'border hover:bg-[var(--color-muted)]'
            }`}
          >
            {s === 'all' ? t('filterAll') : t(`statuses.${s}`)}
          </Link>
        ))}
      </nav>

      <PayoutsTable rows={rows} />
    </main>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
