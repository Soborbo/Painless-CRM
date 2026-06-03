import { requireRole } from '@/lib/auth/require-role';
import { getCompanySettings } from '@/lib/queries/settings';
import { getTranslations } from 'next-intl/server';
import { CompanySettingsForm } from './company-form';

const COMPANY_ROLES = ['manager', 'admin', 'super_admin'] as const;

export default async function CompanySettingsPage() {
  await requireRole(COMPANY_ROLES);
  const settings = await getCompanySettings();
  const t = await getTranslations('companySettings');

  return (
    <main className="mx-auto max-w-2xl px-6 py-8">
      <h1 className="text-xl font-semibold">{t('title')}</h1>
      <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{t('subtitle')}</p>
      <CompanySettingsForm settings={settings} />
    </main>
  );
}
