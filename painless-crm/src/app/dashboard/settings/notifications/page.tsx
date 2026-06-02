import { NotificationPreferencesForm } from '@/components/domain/notification-preferences-form';
import { requireUser } from '@/lib/auth/require-role';
import { getMyNotificationPreferences } from '@/lib/queries/notification-preferences';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function NotificationSettingsPage() {
  const me = await requireUser();
  const [prefs, t] = await Promise.all([
    getMyNotificationPreferences(me.id),
    getTranslations('notifications.prefs'),
  ]);

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <p className="text-sm text-[var(--color-muted-foreground)]">
        <Link href="/dashboard/notifications" className="hover:underline">
          ← {t('backToCenter')}
        </Link>
      </p>
      <h1 className="mb-1 mt-1 text-2xl font-semibold tracking-tight">{t('title')}</h1>
      <p className="mb-6 text-sm text-[var(--color-muted-foreground)]">{t('intro')}</p>
      <NotificationPreferencesForm prefs={prefs} />
    </main>
  );
}
