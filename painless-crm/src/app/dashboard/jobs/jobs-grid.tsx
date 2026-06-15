import type { JobAddressMap } from '@/lib/queries/job-addresses';
import type { JobListRow } from '@/lib/queries/jobs';
import { getTranslations } from 'next-intl/server';
import { JobCard } from './job-card';

export async function JobsGrid({
  rows,
  addresses,
  isAdmin,
}: {
  rows: JobListRow[];
  addresses: JobAddressMap;
  isAdmin: boolean;
}) {
  const t = await getTranslations('jobs');

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-16 text-center">
        <span className="text-3xl" aria-hidden>
          🗂
        </span>
        <p className="text-sm text-[var(--color-muted-foreground)]">{t('emptyList')}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {rows.map((row) => (
        <JobCard key={row.id} row={row} addresses={addresses[row.id] ?? []} isAdmin={isAdmin} />
      ))}
    </div>
  );
}
