import { ContainerForm } from '@/components/domain/storage/container-form';
import { requireRole } from '@/lib/auth/require-role';
import { getContainer } from '@/lib/queries/storage';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

type Props = { params: Promise<{ siteId: string; containerId: string }> };

export default async function EditContainerPage({ params }: Props) {
  const { siteId, containerId } = await params;
  await requireRole(['manager', 'admin', 'super_admin']);
  const container = await getContainer(containerId);
  if (!container || container.storage_site_id !== siteId) notFound();

  const t = await getTranslations('storage');

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t('editContainer')}</h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          {container.container_code}
        </p>
      </header>
      <ContainerForm
        mode="edit"
        siteId={siteId}
        id={container.id}
        version={container.version}
        defaults={{
          container_code: container.container_code,
          size_cubic_ft: container.size_cubic_ft != null ? String(container.size_cubic_ft) : '',
          monthly_rate_pounds: (container.monthly_rate_pence / 100).toFixed(2),
          status: isKnownStatus(container.status) ? container.status : 'available',
          notes: container.notes ?? '',
        }}
      />
    </main>
  );
}

function isKnownStatus(s: string | null): s is string {
  return typeof s === 'string' && s.length > 0;
}
