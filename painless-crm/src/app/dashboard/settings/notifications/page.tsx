import { NotificationPreferencesForm } from '@/components/domain/notification-preferences-form';
import {
  NotificationSubscriptionsForm,
  type SubscriptionGroup,
} from '@/components/domain/notification-subscriptions-form';
import { hasRole, requireUser } from '@/lib/auth/require-role';
import { EVENT_CATALOG, EVENT_GROUPS } from '@/lib/notifications/events';
import { effectiveFreq } from '@/lib/notifications/prefs';
import {
  getEventPrefsFor,
  getMyNotificationPreferences,
  listCompanyUsers,
} from '@/lib/queries/notification-preferences';
import { getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

const MANAGER_ROLES = ['manager', 'admin', 'super_admin'] as const;

export default async function NotificationSettingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ user?: string }>;
}) {
  const me = await requireUser();
  const isManager = hasRole(me, MANAGER_ROLES);
  const params = (await searchParams) ?? {};

  const [t, locale, companyUsers] = await Promise.all([
    getTranslations('notifications'),
    getLocale(),
    isManager ? listCompanyUsers(me.company_id) : Promise.resolve([]),
  ]);

  // Resolve the target user: managers may edit anyone in their company.
  let targetUserId = me.id;
  if (isManager && params.user && companyUsers.some((u) => u.id === params.user)) {
    targetUserId = params.user;
  }

  const [prefs, eventPrefs] = await Promise.all([
    getMyNotificationPreferences(me.id),
    getEventPrefsFor(targetUserId),
  ]);

  const groups: SubscriptionGroup[] = EVENT_GROUPS.map((groupKey) => ({
    key: groupKey,
    label: t(`subs.groups.${groupKey}`),
    rows: EVENT_CATALOG.filter((e) => e.group === groupKey).map((e) => ({
      key: e.key,
      label: locale === 'hu' ? e.labelHu : e.labelEn,
      freq: effectiveFreq(eventPrefs, e.key),
    })),
  }));

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <p className="text-sm text-[var(--color-muted-foreground)]">
        <Link href="/dashboard/notifications" className="hover:underline">
          ← {t('prefs.backToCenter')}
        </Link>
      </p>
      <h1 className="mb-1 mt-1 text-2xl font-semibold tracking-tight">{t('prefs.title')}</h1>
      <p className="mb-6 text-sm text-[var(--color-muted-foreground)]">{t('prefs.intro')}</p>

      <NotificationPreferencesForm prefs={prefs} />

      <h2 className="mb-1 mt-10 text-lg font-semibold">{t('subs.title')}</h2>
      <p className="mb-4 text-sm text-[var(--color-muted-foreground)]">{t('subs.intro')}</p>

      {isManager ? (
        <form method="get" className="mb-5 flex items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{t('subs.editFor')}</span>
            <select
              name="user"
              defaultValue={targetUserId}
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-background)] px-2 py-1 text-sm"
            >
              <option value={me.id}>{t('subs.myself')}</option>
              {companyUsers
                .filter((u) => u.id !== me.id)
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.label}
                  </option>
                ))}
            </select>
          </label>
          <button
            type="submit"
            className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm"
          >
            {t('subs.view')}
          </button>
        </form>
      ) : null}

      <NotificationSubscriptionsForm groups={groups} targetUserId={targetUserId} />
    </main>
  );
}
