import { ContainerStatusBadge } from '@/components/domain/storage/status-display';
import { requireUser } from '@/lib/auth/require-role';
import { getContainer, getStorageSite } from '@/lib/queries/storage';
import { type RentalRow, listRentalsForContainer } from '@/lib/queries/storage-rental';
import { type ContainerStatus, isContainerStatus } from '@/lib/storage/occupancy';
import {
  canReserveContainer,
  isCurrentRental,
  isRentalStatus,
} from '@/lib/storage/rental-lifecycle';
import { formatDate, formatPence } from '@/lib/utils/format';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DeleteContainerButton } from './delete-button';
import { DuplicateContainerButton } from './duplicate-button';
import { ActivateRentalButton, TerminateRentalButton } from './rental-actions';

type Props = { params: Promise<{ siteId: string; containerId: string }> };

const MANAGE_ROLES = ['manager', 'admin', 'super_admin'] as const;
const ADMIN_ROLES = ['admin', 'super_admin'] as const;

export default async function ContainerDetailPage({ params }: Props) {
  const { siteId, containerId } = await params;
  const me = await requireUser();
  if (!(MANAGE_ROLES as readonly string[]).includes(me.role)) notFound();

  const [site, container] = await Promise.all([getStorageSite(siteId), getContainer(containerId)]);
  if (!site || !container || container.storage_site_id !== siteId) notFound();

  const rentals = await listRentalsForContainer(containerId);
  const t = await getTranslations('storage');
  const isAdmin = (ADMIN_ROLES as readonly string[]).includes(me.role);
  const status: ContainerStatus = isContainerStatus(container.status)
    ? container.status
    : 'available';
  const currentRental = rentals.find((r) => isRentalStatus(r.status) && isCurrentRental(r.status));
  const canRent = canReserveContainer(status);

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
          <DuplicateContainerButton id={container.id} siteId={siteId} />
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

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">{t('rentalsHeading')}</h2>
          {canRent ? (
            <Link
              href={`/dashboard/storage/${siteId}/${containerId}/rent`}
              className="rounded-md bg-[var(--color-primary)] px-3 py-1.5 text-sm font-medium text-[var(--color-primary-foreground)] transition-opacity hover:opacity-90"
            >
              {t('newRental')}
            </Link>
          ) : null}
        </div>

        {currentRental ? (
          <div className="rounded-md border border-[var(--color-primary)]/40 bg-[var(--color-primary)]/5 px-4 py-3 text-sm">
            <p className="font-medium">
              {t('currentCustomer')}:{' '}
              <Link
                href={`/dashboard/customers/${currentRental.customer_id}`}
                className="underline"
              >
                {currentRental.customer_name}
              </Link>
            </p>
            <p className="mt-1 text-[var(--color-muted-foreground)]">
              {t(`status.${status}`)} · {formatPence(currentRental.monthly_rate_pence)}/mo ·{' '}
              {t('since')} {formatDate(currentRental.start_date)}
            </p>
          </div>
        ) : null}

        {rentals.length === 0 ? (
          <p className="rounded-md border bg-[var(--color-muted)]/40 px-4 py-6 text-center text-sm text-[var(--color-muted-foreground)]">
            {t('noRentals')}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--color-muted)]">
                <tr>
                  <th className="px-3 py-2 font-medium">{t('fields.customer')}</th>
                  <th className="px-3 py-2 font-medium">{t('rentalStatus')}</th>
                  <th className="px-3 py-2 font-medium">{t('fields.startDate')}</th>
                  <th className="px-3 py-2 font-medium">{t('endDate')}</th>
                  <th className="px-3 py-2 font-medium">{t('fields.monthlyRatePounds')}</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {rentals.map((r) => (
                  <RentalRowView
                    key={r.id}
                    rental={r}
                    siteId={siteId}
                    containerId={containerId}
                    containerVersion={container.version}
                    statusLabel={isRentalStatus(r.status) ? t(`rentalStates.${r.status}`) : '—'}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

function RentalRowView({
  rental,
  siteId,
  containerId,
  containerVersion,
  statusLabel,
}: {
  rental: RentalRow;
  siteId: string;
  containerId: string;
  containerVersion: number;
  statusLabel: string;
}) {
  const actionProps = {
    rentalId: rental.id,
    rentalVersion: rental.version,
    containerId,
    containerVersion,
    siteId,
  };
  return (
    <tr className="border-t align-top">
      <td className="px-3 py-2">{rental.customer_name}</td>
      <td className="px-3 py-2">{statusLabel}</td>
      <td className="px-3 py-2">{formatDate(rental.start_date)}</td>
      <td className="px-3 py-2">{rental.end_date ? formatDate(rental.end_date) : '—'}</td>
      <td className="px-3 py-2">{formatPence(rental.monthly_rate_pence)}</td>
      <td className="px-3 py-2">
        <div className="flex flex-wrap gap-2">
          {rental.status === 'pending' ? <ActivateRentalButton {...actionProps} /> : null}
          {rental.status === 'pending' || rental.status === 'active' ? (
            <TerminateRentalButton {...actionProps} />
          ) : null}
        </div>
      </td>
    </tr>
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
