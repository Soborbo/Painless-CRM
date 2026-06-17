import { requireUser } from '@/lib/auth/require-role';
import { isCallbackOverdue, listOpenCallbacks } from '@/lib/queries/callbacks';
import { getTranslations } from 'next-intl/server';

import { CallbacksTable } from './callbacks-table';

export const dynamic = 'force-dynamic';

export default async function CallbacksPage() {
  await requireUser();
  const now = new Date();
  const [openRows, t] = await Promise.all([listOpenCallbacks(now), getTranslations('callbacks')]);

  const rows = openRows.map((row) => ({
    ...row,
    overdue: isCallbackOverdue(row.next_action_due_at, now),
  }));

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{t('subtitle')}</p>
      </header>

      <CallbacksTable rows={rows} />
    </main>
  );
}
