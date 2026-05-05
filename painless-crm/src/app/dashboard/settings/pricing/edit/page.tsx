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
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('editTitle')}</h1>
          <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{t('editSubtitle')}</p>
        </div>
        {active && (
          <Link
            href="/dashboard/settings/pricing/edit/matrix"
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-[var(--color-muted)]"
          >
            {t('editMatrixButton')}
          </Link>
        )}
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
