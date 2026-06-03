import { requireRole } from '@/lib/auth/require-role';
import { sortThreadMessages } from '@/lib/messages/thread';
import { getThreadForMessage } from '@/lib/queries/messages';
import { formatDateTime } from '@/lib/utils/format';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';

const ROLES = ['sales', 'manager', 'admin', 'super_admin', 'accounts'] as const;

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

export default async function ThreadPage({ params }: Props) {
  await requireRole(ROLES);
  const { id } = await params;
  const thread = await getThreadForMessage(id);
  if (!thread) notFound();

  const t = await getTranslations('inbox');
  const messages = sortThreadMessages(thread.messages);
  const { anchor } = thread;

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-5 px-6 py-8">
      <nav className="text-sm text-[var(--color-muted-foreground)]">
        <Link href="/dashboard/messages" className="hover:underline">
          {t('title')}
        </Link>
        <span className="mx-1.5">/</span>
        <span>{anchor.customer_name ?? t('noCustomer')}</span>
      </nav>

      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">{anchor.subject ?? t('noSubject')}</h1>
        <div className="ml-auto flex gap-2 text-xs">
          {anchor.customer_id ? (
            <Link
              href={`/dashboard/customers/${anchor.customer_id}`}
              className="rounded-md border px-2 py-1 hover:bg-[var(--color-muted)]"
            >
              {t('openCustomer')}
            </Link>
          ) : null}
          {anchor.job_id ? (
            <Link
              href={`/dashboard/jobs/${anchor.job_id}`}
              className="rounded-md border px-2 py-1 hover:bg-[var(--color-muted)]"
            >
              {t('openJob')}
            </Link>
          ) : null}
        </div>
      </header>

      <div className="flex flex-col gap-3">
        {messages.map((m) => {
          const inbound = m.direction === 'inbound';
          return (
            <article
              key={m.id}
              className={`max-w-[85%] rounded-md border p-3 text-sm ${
                inbound ? 'self-start bg-[var(--color-muted)]/30' : 'self-end bg-blue-50'
              }`}
            >
              <div className="mb-1 flex items-center gap-2 text-[11px] text-[var(--color-muted-foreground)]">
                <span className="font-medium">{inbound ? t('inbound') : t('outbound')}</span>
                <span className="uppercase">{m.channel ?? '—'}</span>
                <span>{m.sent_at ? formatDateTime(m.sent_at) : '—'}</span>
              </div>
              {m.subject ? <p className="font-medium">{m.subject}</p> : null}
              <p className="whitespace-pre-wrap">{m.body}</p>
            </article>
          );
        })}
      </div>

      <p className="rounded-md border border-dashed p-3 text-xs text-[var(--color-muted-foreground)]">
        {t('readOnlyNote')}
      </p>
    </main>
  );
}
