import { requireRole } from '@/lib/auth/require-role';
import { getDocumentText } from '@/lib/queries/customisation';
import { getTranslations } from 'next-intl/server';
import { DocumentTextForm } from './form';

const ROLES = ['admin', 'super_admin'] as const;

export default async function DocumentTextPage() {
  await requireRole(ROLES);
  const [text, t] = await Promise.all([getDocumentText(), getTranslations('documentText')]);

  return (
    <main className="mx-auto max-w-2xl px-6 py-8">
      <h1 className="text-xl font-semibold">{t('title')}</h1>
      <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{t('subtitle')}</p>
      <DocumentTextForm text={text} />
    </main>
  );
}
