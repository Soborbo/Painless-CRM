'use client';

import { type ActionState, revokeInvitation } from '@/lib/auth/invitations';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

const INITIAL: ActionState = { ok: false };

type InviteRow = {
  id: string;
  email: string;
  role: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
};

export function InvitationsList({ rows }: { rows: InviteRow[] }) {
  const t = useTranslations('users');
  const tc = useTranslations('common');
  const [state, action, pending] = useActionState(revokeInvitation, INITIAL);

  if (rows.length === 0) {
    return <p className="text-sm text-[var(--color-muted-foreground)]">{t('noPending')}</p>;
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-left text-sm">
        <thead className="bg-[var(--color-muted)]">
          <tr>
            <th className="px-3 py-2 font-medium">{t('inviteEmail')}</th>
            <th className="px-3 py-2 font-medium">{t('inviteRole')}</th>
            <th className="px-3 py-2 font-medium">{t('expiresAt')}</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t">
              <td className="px-3 py-2">{row.email}</td>
              <td className="px-3 py-2">{t(`roles.${row.role}` as never)}</td>
              <td className="px-3 py-2">{new Date(row.expires_at).toLocaleDateString()}</td>
              <td className="px-3 py-2 text-right">
                <form action={action}>
                  <input type="hidden" name="id" value={row.id} />
                  <button
                    type="submit"
                    disabled={pending}
                    className="text-xs underline disabled:opacity-50"
                  >
                    {pending ? tc('loading') : t('revoke')}
                  </button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {state.message && !state.ok ? (
        <p className="px-3 py-2 text-sm text-[var(--color-danger)]">{state.message}</p>
      ) : null}
    </div>
  );
}
