import { countMyUnread } from '@/lib/queries/notifications';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

// Phase 15 — top-bar notification bell. Server component: renders the current
// unread count as a badge and links to the notification center. Real-time
// updates (Supabase Realtime) land later; for now the count refreshes on
// navigation, which the revalidatePath in the mark-read actions drives.
export async function NotificationBell() {
  const [count, t] = await Promise.all([countMyUnread(), getTranslations('notifications')]);
  const capped = count > 99 ? '99+' : String(count);

  return (
    <Link
      href="/dashboard/notifications"
      aria-label={t('bellLabel', { count })}
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-md border hover:bg-[var(--color-muted)]"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4.5 w-4.5"
      >
        <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
      {count > 0 ? (
        <span className="absolute -right-1 -top-1 inline-flex min-w-4 items-center justify-center rounded-full bg-[var(--color-accent)] px-1 text-[10px] font-semibold leading-4 text-white tabular-nums">
          {capped}
        </span>
      ) : null}
    </Link>
  );
}
