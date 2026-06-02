import { AffiliateForm } from '@/components/domain/affiliate/affiliate-form';
import { requireRole } from '@/lib/auth/require-role';
import { getTranslations } from 'next-intl/server';

export default async function NewAffiliatePage() {
  await requireRole(['manager', 'admin', 'super_admin']);
  const t = await getTranslations('affiliates');

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t('newAffiliate')}</h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{t('newSubtitle')}</p>
      </header>
      <AffiliateForm mode="new" />
    </main>
  );
}
