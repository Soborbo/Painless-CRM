'use client';

import { type RotaActionState, removeAssignment } from '@/lib/actions/rota';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

const INITIAL: RotaActionState = { status: 'idle' };

export function RemoveAssignmentButton({
  id,
  version,
  date,
}: {
  id: string;
  version: number;
  date: string;
}) {
  const t = useTranslations('rota');
  const [state, action, pending] = useActionState(removeAssignment, INITIAL);

  return (
    <form action={action} className="inline print:hidden">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="version" value={version} />
      <input type="hidden" name="date" value={date} />
      <button
        type="submit"
        disabled={pending}
        className="text-xs text-[var(--color-danger)] hover:underline disabled:opacity-50"
        title={state.status === 'error' ? state.message : undefined}
      >
        {t('remove')}
      </button>
    </form>
  );
}
