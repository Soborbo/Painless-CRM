'use client';

import { type ActionState, inviteWorker } from '@/lib/auth/invitations';
import { WORKER_INVITE_ROLES } from '@/lib/schemas/invite';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

const INITIAL: ActionState = { ok: false };

export function InviteAppAccess({ workerId, hasEmail }: { workerId: string; hasEmail: boolean }) {
  const t = useTranslations('workers.appAccess');
  const tw = useTranslations('workers');
  const tc = useTranslations('common');
  const [state, action, pending] = useActionState(inviteWorker, INITIAL);

  if (!hasEmail) {
    return <p className="text-sm text-[var(--color-muted-foreground)]">{t('needsEmail')}</p>;
  }

  return (
    <form action={action} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <input type="hidden" name="worker_id" value={workerId} />
      <label className="flex flex-col gap-1 text-sm sm:w-48">
        {t('roleLabel')}
        <select
          name="role"
          required
          defaultValue="loader"
          className="rounded-md border bg-transparent px-3 py-2 outline-none focus:ring-2"
        >
          {WORKER_INVITE_ROLES.map((role) => (
            <option key={role} value={role}>
              {tw(`roles.${role}`)}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="h-10 rounded-md bg-[var(--color-primary)] px-4 text-sm font-medium text-[var(--color-primary-foreground)] transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending ? tc('loading') : t('sendInvite')}
      </button>
      {state.message ? (
        <p
          className={`text-sm ${state.ok ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}
        >
          {state.ok ? t('sent') : state.message}
        </p>
      ) : null}
    </form>
  );
}
