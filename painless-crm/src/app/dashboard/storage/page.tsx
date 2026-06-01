import { OccupancyBar } from '@/components/domain/storage/status-display';
import { requireRole } from '@/lib/auth/require-role';
import { listStorageSites } from '@/lib/queries/storage';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

export default async function StoragePage() {
  await requireRole(['manager', 'admin', 'super_admin']);
  const sites = await listStorageSites();
  const t = await getTranslations('storage');

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
            {t('siteCount', { count: sites.length })}
          </p>
        </div>
        <Link
          href="/dashboard/storage/new"
          className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-foreground)] transition-opacity hover:opacity-90"
        >
          {t('newSite')}
        </Link>
      </header>

      {sites.length === 0 ? (
        <p className="rounded-md border bg-[var(--color-muted)]/40 px-4 py-10 text-center text-sm text-[var(--color-muted-foreground)]">
          {t('emptySites')}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {sites.map((site) => (
            <Link
              key={site.id}
              href={`/dashboard/storage/${site.id}`}
              className="flex flex-col gap-3 rounded-md border p-4 transition-colors hover:bg-[var(--color-muted)]/40"
            >
              <div>
                <p className="font-medium">
                  {site.name}
                  {!site.active ? (
                    <span className="ml-2 text-xs text-[var(--color-muted-foreground)]">
                      ({t('inactiveBadge')})
                    </span>
                  ) : null}
                </p>
                {site.address ? (
                  <p className="text-sm text-[var(--color-muted-foreground)]">
                    {site.address.line1}, {site.address.city} {site.address.postcode}
                  </p>
                ) : null}
              </div>
              <OccupancyBar occupancy={site.occupancy} label={t('occupancyLabel')} />
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
