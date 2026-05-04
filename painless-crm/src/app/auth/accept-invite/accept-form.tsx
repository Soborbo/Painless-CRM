'use client';

import { type ActionState, acceptInvitation } from '@/lib/auth/invitations';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

const INITIAL: ActionState = { ok: false };

export function AcceptInviteForm({ token, email }: { token: string; email: string }) {
  const t = useTranslations('auth');
  const tc = useTranslations('common');
  const [state, action, pending] = useActionState(acceptInvitation, INITIAL);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <label className="flex flex-col gap-1 text-sm">
        {t('email')}
        <input
          type="email"
          value={email}
          readOnly
          className="rounded-md border bg-[var(--color-muted)] px-3 py-2 outline-none"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        {t('fullName')}
        <input
          type="text"
          name="full_name"
          required
          minLength={1}
          maxLength={120}
          autoComplete="name"
          className="rounded-md border px-3 py-2 outline-none focus:ring-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        {t('newPassword')}
        <input
          type="password"
          name="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="rounded-md border px-3 py-2 outline-none focus:ring-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        {t('confirmPassword')}
        <input
          type="password"
          name="confirmPassword"
          required
          minLength={8}
          autoComplete="new-password"
          className="rounded-md border px-3 py-2 outline-none focus:ring-2"
        />
      </label>
      {state.message ? (
        <p className={`text-sm ${state.ok ? '' : 'text-[var(--color-danger)]'}`}>{state.message}</p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-foreground)] transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending ? tc('loading') : t('acceptInvite')}
      </button>
    </form>
  );
}
