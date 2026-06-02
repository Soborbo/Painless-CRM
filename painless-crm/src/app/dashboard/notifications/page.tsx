import {
  markAllNotificationsReadForm,
  markNotificationReadForm,
} from '@/lib/actions/notifications';
import { requireUser } from '@/lib/auth/require-role';
import { type NotificationRow, listMyNotifications } from '@/lib/queries/notifications';
import { formatDateTime } from '@/lib/utils/format';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function NotificationsPage() {
  await requireUser();
  const [notifications, t] = await Promise.all([
    listMyNotifications(),
    getTranslations('notifications'),
  ]);
  const hasUnread = notifications.some((n) => n.read_at === null);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        {hasUnread ? (
          <form action={markAllNotificationsReadForm}>
            <button
              type="submit"
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-[var(--color-muted)]"
            >
              {t('markAllRead')}
            </button>
          </form>
        ) : null}
      </header>

      {notifications.length === 0 ? (
        <p className="rounded-md border px-4 py-10 text-center text-sm text-[var(--color-muted-foreground)]">
          {t('empty')}
        </p>
      ) : (
        <ul className="flex flex-col divide-y rounded-md border">
          {notifications.map((n) => (
            <NotificationItem key={n.id} notification={n} t={t} />
          ))}
        </ul>
      )}
    </main>
  );
}

function NotificationItem({
  notification: n,
  t,
}: {
  notification: NotificationRow;
  t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  const unread = n.read_at === null;
  const urgent = n.priority === 'urgent' || n.priority === 'high';
  return (
    <li
      className={`flex items-start gap-3 px-4 py-3 ${unread ? 'bg-[var(--color-muted)]/40' : ''}`}
    >
      <span
        aria-hidden
        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
          unread ? (urgent ? 'bg-red-500' : 'bg-[var(--color-accent)]') : 'bg-transparent'
        }`}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className={`truncate text-sm ${unread ? 'font-semibold' : ''}`}>
            {n.link_url ? (
              <Link href={n.link_url} className="hover:underline">
                {n.title}
              </Link>
            ) : (
              n.title
            )}
          </p>
          <time className="shrink-0 font-mono text-xs text-[var(--color-muted-foreground)]">
            {formatDateTime(n.created_at)}
          </time>
        </div>
        {n.body ? (
          <p className="mt-0.5 text-sm text-[var(--color-muted-foreground)]">{n.body}</p>
        ) : null}
      </div>
      {unread ? (
        <form action={markNotificationReadForm}>
          <input type="hidden" name="id" value={n.id} />
          <button
            type="submit"
            className="shrink-0 rounded-md border px-2 py-1 text-xs hover:bg-[var(--color-muted)]"
          >
            {t('markRead')}
          </button>
        </form>
      ) : null}
    </li>
  );
}
