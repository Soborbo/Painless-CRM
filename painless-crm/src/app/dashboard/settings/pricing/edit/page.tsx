import { PricingEditForm } from '@/components/domain/pricing/pricing-edit-form';
import { requireRole } from '@/lib/auth/require-role';
import { getActivePricingVersion } from '@/lib/queries/pricing';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

export default async function PricingEditPage() {
  await requireRole(['admin', 'manager', 'super_admin']);
  const t = await getTranslations('pricing');
  const active = await getActivePricingVersion();

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t('editTitle')}</h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{t('editSubtitle')}</p>
      </header>

      {active ? (
        <PricingEditForm active={{ version_label: active.version_label, config: active.config }} />
      ) : (
        <div className="rounded-md border border-dashed p-6 text-sm">
          <p>{t('noActiveForEdit')}</p>
          <Link href="/dashboard/settings/pricing" className="mt-2 inline-block text-sm underline">
            {t('backToPricing')}
          </Link>
        </div>
      )}
    </main>
  );
}
