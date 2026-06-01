import { ContainerStatusBadge, OccupancyBar } from '@/components/domain/storage/status-display';
import { requireRole } from '@/lib/auth/require-role';
import { getStorageSite, listContainers } from '@/lib/queries/storage';
import {
  type ContainerStatus,
  isContainerStatus,
  summariseOccupancy,
} from '@/lib/storage/occupancy';
import { formatPence } from '@/lib/utils/format';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';

type Props = { params: Promise<{ siteId: string }> };

export default async function StorageSitePage({ params }: Props) {
  const { siteId } = await params;
  await requireRole(['manager', 'admin', 'super_admin']);
  const site = await getStorageSite(siteId);
  if (!site) notFound();

  const containers = await listContainers(siteId);
  const occupancy = summariseOccupancy(containers.map((c) => c.status));
  const t = await getTranslations('storage');

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-[16rem]">
          <p className="text-sm text-[var(--color-muted-foreground)]">
            <Link href="/dashboard/storage" className="hover:underline">
              {t('title')}
            </Link>
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{site.name}</h1>
          {site.address ? (
            <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
              {site.address.line1}
              {site.address.line2 ? `, ${site.address.line2}` : ''}, {site.address.city}{' '}
              {site.address.postcode}
            </p>
          ) : null}
          <div className="mt-3 max-w-xs">
            <OccupancyBar occupancy={occupancy} label={t('occupancyLabel')} />
          </div>
        </div>
        <Link
          href={`/dashboard/storage/${siteId}/containers/new`}
          className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-foreground)] transition-opacity hover:opacity-90"
        >
          {t('addContainer')}
        </Link>
      </header>

      {containers.length === 0 ? (
        <p className="rounded-md border bg-[var(--color-muted)]/40 px-4 py-10 text-center text-sm text-[var(--color-muted-foreground)]">
          {t('emptyContainers')}
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {containers.map((c) => {
            const status: ContainerStatus = isContainerStatus(c.status) ? c.status : 'available';
            return (
              <Link
                key={c.id}
                href={`/dashboard/storage/${siteId}/${c.id}`}
                className="flex flex-col gap-2 rounded-md border p-4 transition-colors hover:bg-[var(--color-muted)]/40"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{c.container_code}</span>
                  <ContainerStatusBadge status={status} text={t(`status.${status}`)} />
                </div>
                <p className="text-sm text-[var(--color-muted-foreground)]">
                  {c.size_cubic_ft != null ? `${c.size_cubic_ft} ft³ · ` : ''}
                  {formatPence(c.monthly_rate_pence)}/mo
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
