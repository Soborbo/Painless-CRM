'use client';

import {
  INITIAL_PREFERENCES_STATE,
  updateNotificationPreferences,
} from '@/lib/actions/notification-preferences';
import type { MyNotificationPreferences } from '@/lib/queries/notification-preferences';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

export function NotificationPreferencesForm({ prefs }: { prefs: MyNotificationPreferences }) {
  const t = useTranslations('notifications.prefs');
  const [state, action, pending] = useActionState(
    updateNotificationPreferences,
    INITIAL_PREFERENCES_STATE,
  );

  return (
    <form action={action} className="flex flex-col gap-5">
      <Toggle
        name="email_digest_enabled"
        defaultChecked={prefs.emailDigestEnabled}
        label={t('emailDigest')}
        hint={t('emailDigestHint')}
      />
      <Toggle
        name="push_enabled"
        defaultChecked={prefs.pushEnabled}
        label={t('push')}
        hint={t('pushHint')}
      />

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-foreground)] disabled:opacity-60"
        >
          {pending ? t('saving') : t('save')}
        </button>
        {state.status === 'ok' ? (
          <span className="text-sm text-green-700">{t('saved')}</span>
        ) : null}
        {state.status === 'error' ? (
          <span className="text-sm text-red-700">{state.message}</span>
        ) : null}
      </div>
    </form>
  );
}

function Toggle({
  name,
  defaultChecked,
  label,
  hint,
}: {
  name: string;
  defaultChecked: boolean;
  label: string;
  hint: string;
}) {
  return (
    <label className="flex items-start gap-3">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="mt-1 h-4 w-4 shrink-0"
      />
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-[var(--color-muted-foreground)]">{hint}</span>
      </span>
    </label>
  );
}
