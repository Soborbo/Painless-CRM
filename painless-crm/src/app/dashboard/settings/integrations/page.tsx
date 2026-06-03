import { requireRole } from '@/lib/auth/require-role';
import { getIntegrationStatuses } from '@/lib/queries/integrations';
import { getTranslations } from 'next-intl/server';

const ROLES = ['admin', 'super_admin'] as const;

export default async function IntegrationsPage() {
  await requireRole(ROLES);
  const [rows, t] = await Promise.all([getIntegrationStatuses(), getTranslations('integrations')]);

  return (
    <main className="mx-auto max-w-2xl px-6 py-8">
      <h1 className="text-xl font-semibold">{t('title')}</h1>
      <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{t('subtitle')}</p>

      <ul className="mt-6 flex flex-col divide-y rounded-md border">
        {rows.map((r) => (
          <li key={r.provider} className="flex items-center justify-between gap-3 p-3 text-sm">
            <div>
              <span className="font-medium">{t(`provider_${r.provider}`)}</span>
              <span className="ml-2 text-xs text-[var(--color-muted-foreground)]">
                {t(`category_${r.category}`)}
              </span>
            </div>
            {r.builtIn ? (
              <span className="rounded bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-900">
                {t('builtIn')}
              </span>
            ) : r.connected ? (
              <span className="rounded bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-900">
                {t('connected')}
              </span>
            ) : (
              <span className="rounded bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600">
                {t('notConnected')}
              </span>
            )}
          </li>
        ))}
      </ul>

      <p className="mt-4 text-xs text-[var(--color-muted-foreground)]">{t('note')}</p>
    </main>
  );
}
