import { requireRole } from '@/lib/auth/require-role';
import { getJobSheetFieldDefs } from '@/lib/queries/custom-fields';
import { getTranslations } from 'next-intl/server';
import { AddJobSheetFieldForm } from './add-form';
import { DeleteJobSheetFieldButton } from './delete-button';

const ROLES = ['admin', 'super_admin'] as const;

export default async function JobSheetFieldsPage() {
  await requireRole(ROLES);
  const [defs, t] = await Promise.all([
    getJobSheetFieldDefs(),
    getTranslations('jobSheetFields'),
  ]);

  return (
    <main className="mx-auto max-w-2xl px-6 py-8">
      <h1 className="text-xl font-semibold">{t('title')}</h1>
      <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{t('subtitle')}</p>

      <section className="mt-6">
        <h2 className="text-sm font-semibold">{t('current')}</h2>
        {defs.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">{t('none')}</p>
        ) : (
          <ul className="mt-2 flex flex-col divide-y rounded-md border">
            {defs.map((def) => (
              <li key={def.key} className="flex items-center justify-between gap-3 p-3 text-sm">
                <div className="min-w-0">
                  <span className="font-medium">{def.label}</span>
                  <span className="ml-2 font-mono text-xs text-[var(--color-muted-foreground)]">
                    {def.key} · {def.type}
                    {def.required ? ` · ${t('required')}` : ''}
                    {def.options?.length ? ` · ${def.options.join(', ')}` : ''}
                  </span>
                </div>
                <DeleteJobSheetFieldButton fieldKey={def.key} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold">{t('addHeading')}</h2>
        <AddJobSheetFieldForm />
      </section>
    </main>
  );
}
