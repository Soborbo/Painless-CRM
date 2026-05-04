'use client';

import { type ActionState, inviteUser } from '@/lib/auth/invitations';
import { INVITABLE_ROLES } from '@/lib/schemas/invite';
import { useTranslations } from 'next-intl';
import { useActionState, useEffect, useRef } from 'react';

const INITIAL: ActionState = { ok: false };

export function InviteForm() {
  const t = useTranslations('users');
  const tc = useTranslations('common');
  const [state, action, pending] = useActionState(inviteUser, INITIAL);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <label className="flex flex-1 flex-col gap-1 text-sm">
        {t('inviteEmail')}
        <input
          type="email"
          name="email"
          required
          autoComplete="off"
          className="rounded-md border px-3 py-2 outline-none focus:ring-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm sm:w-48">
        {t('inviteRole')}
        <select
          name="role"
          required
          defaultValue="sales"
          className="rounded-md border bg-transparent px-3 py-2 outline-none focus:ring-2"
        >
          {INVITABLE_ROLES.map((role) => (
            <option key={role} value={role}>
              {t(`roles.${role}`)}
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
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
