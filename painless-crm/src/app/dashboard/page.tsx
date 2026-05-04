import { requireUser } from '@/lib/auth/require-role';
import { getTranslations } from 'next-intl/server';

export default async function DashboardPage() {
  const profile = await requireUser();
  const t = await getTranslations('dashboard');

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
      <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
        {t('signedInAs', { name: profile.full_name, role: profile.role })}
      </p>
      <section className="mt-8 rounded-md border p-6">
        <h2 className="text-lg font-medium">{t('emptyTitle')}</h2>
        <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">{t('emptyBody')}</p>
      </section>
    </main>
  );
}
