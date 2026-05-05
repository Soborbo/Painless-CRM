import { SimulatorForm } from '@/components/domain/pricing/simulator-form';
import { requireRole } from '@/lib/auth/require-role';
import { getActivePricingVersion } from '@/lib/queries/pricing';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

export default async function PricingSimulatorPage() {
  await requireRole(['admin', 'manager', 'super_admin']);
  const t = await getTranslations('pricing');
  const active = await getActivePricingVersion();

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t('simulatorTitle')}</h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          {t('simulatorSubtitle')}
        </p>
      </header>

      {active ? (
        <SimulatorForm
          options={{
            size_categories: active.config.size_categories,
            complications: active.config.complications,
            modulation_sources: active.config.modulation_sources,
            version_label: active.version_label,
          }}
        />
      ) : (
        <div className="rounded-md border border-dashed p-6 text-sm">
          <p>{t('noActiveForSimulator')}</p>
          <Link href="/dashboard/settings/pricing" className="mt-2 inline-block text-sm underline">
            {t('backToPricing')}
          </Link>
        </div>
      )}
    </main>
  );
}
