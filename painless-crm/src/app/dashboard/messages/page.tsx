import { requireRole } from '@/lib/auth/require-role';
import { groupThreads } from '@/lib/messages/thread';
import { listRecentMessages } from '@/lib/queries/messages';
import { formatDateTime } from '@/lib/utils/format';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

const ROLES = ['sales', 'manager', 'admin', 'super_admin', 'accounts'] as const;

export const dynamic = 'force-dynamic';

export default async function MessagesPage() {
  await requireRole(ROLES);
  const [messages, t] = await Promise.all([listRecentMessages(), getTranslations('inbox')]);
  const threads = groupThreads(messages);

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-5 px-6 py-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{t('subtitle')}</p>
      </header>

      {threads.length === 0 ? (
        <p className="rounded-md border p-6 text-sm text-[var(--color-muted-foreground)]">
          {t('empty')}
        </p>
      ) : (
        <ul className="flex flex-col divide-y rounded-md border">
          {threads.map((thread) => (
            <li key={thread.key}>
              <Link
                href={`/dashboard/messages/${thread.routeId}`}
                className="flex items-start gap-3 p-3 hover:bg-[var(--color-muted)]/40"
              >
                <span className="mt-0.5 rounded bg-[var(--color-muted)] px-1.5 py-0.5 text-[10px] font-medium uppercase">
                  {thread.channel ?? '—'}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">
                      {thread.customerName ?? t('noCustomer')}
                    </span>
                    {thread.needsReply ? (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-900">
                        {t('needsReply')}
                      </span>
                    ) : null}
                    {thread.count > 1 ? (
                      <span className="text-[11px] text-[var(--color-muted-foreground)]">
                        {t('count', { count: thread.count })}
                      </span>
                    ) : null}
                  </div>
                  {thread.subject ? (
                    <p className="truncate text-xs font-medium">{thread.subject}</p>
                  ) : null}
                  <p className="truncate text-xs text-[var(--color-muted-foreground)]">
                    {thread.lastDirection === 'inbound' ? '← ' : '→ '}
                    {thread.preview}
                  </p>
                </div>
                <span className="shrink-0 text-[11px] text-[var(--color-muted-foreground)]">
                  {thread.lastAt ? formatDateTime(thread.lastAt) : '—'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
