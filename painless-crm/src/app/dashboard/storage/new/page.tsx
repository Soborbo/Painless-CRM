import { SiteForm } from '@/components/domain/storage/site-form';
import { requireRole } from '@/lib/auth/require-role';
import { getTranslations } from 'next-intl/server';

export default async function NewStorageSitePage() {
  await requireRole(['manager', 'admin', 'super_admin']);
  const t = await getTranslations('storage');

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t('newSite')}</h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{t('newSiteSubtitle')}</p>
      </header>
      <SiteForm />
    </main>
  );
}
