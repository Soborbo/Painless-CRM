import { ContainerStatusBadge } from '@/components/domain/storage/status-display';
import { requireUser } from '@/lib/auth/require-role';
import { getContainer, getStorageSite } from '@/lib/queries/storage';
import { type ContainerStatus, isContainerStatus } from '@/lib/storage/occupancy';
import { formatPence } from '@/lib/utils/format';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DeleteContainerButton } from './delete-button';

type Props = { params: Promise<{ siteId: string; containerId: string }> };

const MANAGE_ROLES = ['manager', 'admin', 'super_admin'] as const;
const ADMIN_ROLES = ['admin', 'super_admin'] as const;

export default async function ContainerDetailPage({ params }: Props) {
  const { siteId, containerId } = await params;
  const me = await requireUser();
  if (!(MANAGE_ROLES as readonly string[]).includes(me.role)) notFound();

  const [site, container] = await Promise.all([getStorageSite(siteId), getContainer(containerId)]);
  if (!site || !container || container.storage_site_id !== siteId) notFound();

  const t = await getTranslations('storage');
  const isAdmin = (ADMIN_ROLES as readonly string[]).includes(me.role);
  const status: ContainerStatus = isContainerStatus(container.status)
    ? container.status
    : 'available';

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            <Link href="/dashboard/storage" className="hover:underline">
              {t('title')}
            </Link>{' '}
            /{' '}
            <Link href={`/dashboard/storage/${siteId}`} className="hover:underline">
              {site.name}
            </Link>
          </p>
          <h1 className="mt-1 flex items-center gap-3 text-2xl font-semibold tracking-tight">
            {container.container_code}
            <ContainerStatusBadge status={status} text={t(`status.${status}`)} />
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/dashboard/storage/${siteId}/${containerId}/edit`}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-[var(--color-muted)]"
          >
            {t('edit')}
          </Link>
          {isAdmin ? (
            <DeleteContainerButton id={container.id} siteId={siteId} version={container.version} />
          ) : null}
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        <Detail label={t('fields.sizeCubicFt')}>
          {container.size_cubic_ft != null ? `${container.size_cubic_ft} ft³` : '—'}
        </Detail>
        <Detail label={t('fields.monthlyRatePounds')}>
          {formatPence(container.monthly_rate_pence)}
        </Detail>
        {container.notes ? <Detail label={t('fields.notes')}>{container.notes}</Detail> : null}
      </section>

      <p className="rounded-md border bg-[var(--color-muted)]/40 px-4 py-3 text-sm text-[var(--color-muted-foreground)]">
        {t('rentalsComingSoon')}
      </p>
    </main>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
        {label}
      </p>
      <p className="mt-1 text-sm">{children}</p>
    </div>
  );
}
