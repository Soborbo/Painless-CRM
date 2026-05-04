import { requireRole } from '@/lib/auth/require-role';
import { listPricingVersions } from '@/lib/queries/pricing';
import { formatDateTime } from '@/lib/utils/format';
import { getTranslations } from 'next-intl/server';

export default async function PricingSettingsPage() {
  await requireRole(['admin', 'manager', 'super_admin']);
  const t = await getTranslations('pricing');
  const rows = await listPricingVersions();
  const active = rows.find((r) => r.effective_to === null) ?? null;

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-10 px-6 py-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{t('subtitle')}</p>
      </header>

      <section className="flex flex-col gap-3 rounded-md border p-6">
        <h2 className="text-lg font-medium">{t('activeVersion')}</h2>
        {active ? (
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <dt className="text-[var(--color-muted-foreground)]">{t('label')}</dt>
            <dd className="font-medium">{active.version_label}</dd>
            <dt className="text-[var(--color-muted-foreground)]">{t('effectiveFrom')}</dt>
            <dd>{formatDateTime(active.effective_from)}</dd>
            <dt className="text-[var(--color-muted-foreground)]">{t('publishedBy')}</dt>
            <dd>{active.created_by?.full_name ?? '—'}</dd>
          </dl>
        ) : (
          <p className="text-sm text-[var(--color-muted-foreground)]">{t('noActive')}</p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">{t('history')}</h2>
        {rows.length === 0 ? (
          <p className="text-sm text-[var(--color-muted-foreground)]">{t('emptyHistory')}</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead className="border-b text-left text-[var(--color-muted-foreground)]">
              <tr>
                <th className="py-2 pr-4">{t('label')}</th>
                <th className="py-2 pr-4">{t('effectiveFrom')}</th>
                <th className="py-2 pr-4">{t('effectiveTo')}</th>
                <th className="py-2 pr-4">{t('publishedBy')}</th>
                <th className="py-2 pr-4">{t('notes')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b last:border-b-0">
                  <td className="py-2 pr-4 font-medium">{row.version_label}</td>
                  <td className="py-2 pr-4">{formatDateTime(row.effective_from)}</td>
                  <td className="py-2 pr-4">
                    {row.effective_to ? formatDateTime(row.effective_to) : t('current')}
                  </td>
                  <td className="py-2 pr-4">{row.created_by?.full_name ?? '—'}</td>
                  <td className="py-2 pr-4 text-[var(--color-muted-foreground)]">
                    {row.notes ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="rounded-md border border-dashed p-6 text-sm text-[var(--color-muted-foreground)]">
        {t('editorComingSoon')}
      </section>
    </main>
  );
}
