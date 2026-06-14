'use client';

import {
  INITIAL_PREFERENCES_STATE,
  updateEventPrefs,
} from '@/lib/actions/notification-preferences';
import { FREQUENCIES, type Frequency } from '@/lib/notifications/prefs';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

export interface SubscriptionRow {
  key: string;
  label: string;
  freq: Frequency;
}

export interface SubscriptionGroup {
  key: string;
  label: string;
  rows: SubscriptionRow[];
}

export function NotificationSubscriptionsForm({
  groups,
  targetUserId,
}: {
  groups: SubscriptionGroup[];
  targetUserId: string;
}) {
  const t = useTranslations('notifications.subs');
  const [state, action, pending] = useActionState(updateEventPrefs, INITIAL_PREFERENCES_STATE);

  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="target_user_id" value={targetUserId} />

      {groups.map((group) => (
        <fieldset key={group.key} className="rounded-lg border border-[var(--color-border)] p-4">
          <legend className="px-1 text-sm font-semibold">{group.label}</legend>
          <div className="flex flex-col divide-y divide-[var(--color-border)]">
            {group.rows.map((row) => (
              <div key={row.key} className="flex items-center justify-between gap-4 py-2">
                <span className="text-sm">{row.label}</span>
                <select
                  name={`freq_${row.key}`}
                  defaultValue={row.freq}
                  className="rounded-md border border-[var(--color-border)] bg-[var(--color-background)] px-2 py-1 text-sm"
                >
                  {FREQUENCIES.map((freq) => (
                    <option key={freq} value={freq}>
                      {t(`freq.${freq}`)}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </fieldset>
      ))}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-foreground)] disabled:opacity-60"
        >
          {pending ? t('saving') : t('save')}
        </button>
        {state.status === 'ok' ? <span className="text-sm text-green-700">{t('saved')}</span> : null}
        {state.status === 'error' ? (
          <span className="text-sm text-red-700">{state.message}</span>
        ) : null}
      </div>
    </form>
  );
}
