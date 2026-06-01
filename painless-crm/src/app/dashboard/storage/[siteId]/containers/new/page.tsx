import { ContainerForm } from '@/components/domain/storage/container-form';
import { requireRole } from '@/lib/auth/require-role';
import { getStorageSite } from '@/lib/queries/storage';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

type Props = { params: Promise<{ siteId: string }> };

export default async function NewContainerPage({ params }: Props) {
  const { siteId } = await params;
  await requireRole(['manager', 'admin', 'super_admin']);
  const site = await getStorageSite(siteId);
  if (!site) notFound();

  const t = await getTranslations('storage');

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t('addContainer')}</h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{site.name}</p>
      </header>
      <ContainerForm mode="new" siteId={siteId} />
    </main>
  );
}
