import { requireRole } from '@/lib/auth/require-role';
import { type ProfitRange, resolveRange } from '@/lib/jobs/profit-dashboard';
import { listAnalyticsJobs } from '@/lib/queries/reports';
import { listRentalsForReport } from '@/lib/queries/storage-rental';
import { buildStorageReport } from '@/lib/reports/storage';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { JobsAnalytics } from './jobs-analytics';
import { StorageAnalytics } from './storage-analytics';

const ROLES = ['manager', 'admin', 'super_admin'] as const;
const RANGES = ['month', 'quarter'] as const satisfies readonly ProfitRange[];

export const dynamic = 'force-dynamic';

type View = 'jobs' | 'storage';
type Props = { searchParams: Promise<{ view?: string; range?: string }> };

function parseRange(v: string | undefined): ProfitRange {
  return (RANGES as readonly string[]).includes(v ?? '') ? (v as ProfitRange) : 'month';
}

export default async function AnalyticsPage({ searchParams }: Props) {
  await requireRole(ROLES);
  const sp = await searchParams;
  const view: View = sp.view === 'storage' ? 'storage' : 'jobs';
  const range = parseRange(sp.range);
  const window = resolveRange(range, new Date());
  const t = await getTranslations('analytics');

  const href = (next: Partial<{ view: View; range: ProfitRange }>) =>
    `/dashboard/reports/analytics?view=${next.view ?? view}&range=${next.range ?? range}`;

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{t('subtitle')}</p>
      </header>

      <div className="flex flex-wrap items-center gap-4 text-sm">
        <div className="flex gap-1">
          <Toggle active={view === 'jobs'} href={href({ view: 'jobs' })} label={t('jobs')} />
          <Toggle
            active={view === 'storage'}
            href={href({ view: 'storage' })}
            label={t('storage')}
          />
        </div>
        <div className="ml-auto flex gap-1">
          <Toggle active={range === 'month'} href={href({ range: 'month' })} label={t('month')} />
          <Toggle
            active={range === 'quarter'}
            href={href({ range: 'quarter' })}
            label={t('quarter')}
          />
        </div>
      </div>

      {view === 'jobs' ? (
        <JobsAnalytics rows={await listAnalyticsJobs(window)} />
      ) : (
        <StorageAnalytics report={buildStorageReport(await listRentalsForReport(), window)} />
      )}
    </main>
  );
}

function Toggle({ active, href, label }: { active: boolean; href: string; label: string }) {
  return (
    <Link
      href={href}
      className={
        active
          ? 'rounded-md bg-[var(--color-primary)] px-3 py-1.5 text-xs font-medium text-[var(--color-primary-foreground)]'
          : 'rounded-md border px-3 py-1.5 text-xs hover:bg-[var(--color-muted)]'
      }
    >
      {label}
    </Link>
  );
}
