import { requireRole } from '@/lib/auth/require-role';
import { getLeadProviders } from '@/lib/queries/customisation';
import { getTranslations } from 'next-intl/server';
import { AddProviderForm, DeleteProviderButton } from './forms';

const ROLES = ['admin', 'super_admin'] as const;

export default async function LeadProvidersPage() {
  await requireRole(ROLES);
  const [providers, t] = await Promise.all([getLeadProviders(), getTranslations('leadProviders')]);

  return (
    <main className="mx-auto max-w-2xl px-6 py-8">
      <h1 className="text-xl font-semibold">{t('title')}</h1>
      <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{t('subtitle')}</p>

      <section className="mt-6">
        <h2 className="text-sm font-semibold">{t('current')}</h2>
        {providers.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">{t('none')}</p>
        ) : (
          <ul className="mt-2 flex flex-col divide-y rounded-md border">
            {providers.map((p) => (
              <li key={p.name} className="flex items-center justify-between gap-3 p-3 text-sm">
                <span>
                  <span className="font-medium">{p.name}</span>
                  <span className="ml-2 font-mono text-xs text-[var(--color-muted-foreground)]">
                    → {p.source_key}
                    {p.active ? '' : ` · ${t('inactive')}`}
                  </span>
                </span>
                <DeleteProviderButton name={p.name} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold">{t('addHeading')}</h2>
        <AddProviderForm />
      </section>
    </main>
  );
}
