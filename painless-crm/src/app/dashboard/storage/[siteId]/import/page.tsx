import { requireRole } from '@/lib/auth/require-role';
import { getStorageSite } from '@/lib/queries/storage';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ContainerImportForm } from './import-form';

const ROLES = ['manager', 'admin', 'super_admin'] as const;

type Props = { params: Promise<{ siteId: string }> };

export default async function ImportContainersPage({ params }: Props) {
  await requireRole(ROLES);
  const { siteId } = await params;
  const site = await getStorageSite(siteId);
  if (!site) notFound();
  const t = await getTranslations('storageImport');

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-5 px-6 py-8">
      <nav className="text-sm text-[var(--color-muted-foreground)]">
        <Link href={`/dashboard/storage/${siteId}`} className="hover:underline">
          {site.name}
        </Link>
        <span className="mx-1.5">/</span>
        <span>{t('title')}</span>
      </nav>

      <header>
        <h1 className="text-xl font-semibold">{t('title')}</h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{t('subtitle')}</p>
      </header>

      <ContainerImportForm siteId={siteId} />
    </main>
  );
}
