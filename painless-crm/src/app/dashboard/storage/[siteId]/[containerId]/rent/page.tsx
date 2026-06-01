import { RentalForm } from '@/components/domain/storage/rental-form';
import { requireRole } from '@/lib/auth/require-role';
import { listCustomerOptions } from '@/lib/queries/customers';
import { getContainer } from '@/lib/queries/storage';
import type { ContainerStatus } from '@/lib/storage/occupancy';
import { canReserveContainer } from '@/lib/storage/rental-lifecycle';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';

type Props = { params: Promise<{ siteId: string; containerId: string }> };

export default async function NewRentalPage({ params }: Props) {
  const { siteId, containerId } = await params;
  await requireRole(['manager', 'admin', 'super_admin']);

  const container = await getContainer(containerId);
  if (!container || container.storage_site_id !== siteId) notFound();

  const t = await getTranslations('storage');
  const status = (container.status ?? 'available') as ContainerStatus;

  if (!canReserveContainer(status)) {
    return (
      <main className="mx-auto flex max-w-2xl flex-col gap-4 px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">{container.container_code}</h1>
        <p className="rounded-md border bg-[var(--color-muted)]/40 px-4 py-6 text-sm text-[var(--color-muted-foreground)]">
          {t('notAvailableToRent')}
        </p>
        <Link href={`/dashboard/storage/${siteId}/${containerId}`} className="text-sm underline">
          {t('backToContainer')}
        </Link>
      </main>
    );
  }

  const customers = await listCustomerOptions();
  const today = new Date().toISOString().slice(0, 10);

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t('newRental')}</h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          {container.container_code}
        </p>
      </header>
      <RentalForm
        siteId={siteId}
        containerId={containerId}
        defaultRatePounds={(container.monthly_rate_pence / 100).toFixed(2)}
        customers={customers}
        defaultStartDate={today}
      />
    </main>
  );
}
