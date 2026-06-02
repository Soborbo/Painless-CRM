'use client';

import { type AffiliateActionState, setAffiliateActive } from '@/lib/actions/affiliates';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

const INITIAL: AffiliateActionState = { status: 'idle' };

export function AffiliateStatusToggle({
  id,
  version,
  active,
}: {
  id: string;
  version: number;
  active: boolean;
}) {
  const t = useTranslations('affiliates');
  const [state, action, pending] = useActionState(setAffiliateActive, INITIAL);

  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="version" value={version} />
      <input type="hidden" name="active" value={String(!active)} />
      <button
        type="submit"
        disabled={pending}
        className={`rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${
          active
            ? 'border hover:bg-[var(--color-muted)]'
            : 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)] hover:opacity-90'
        }`}
      >
        {active ? t('pause') : t('approve')}
      </button>
      {state.status === 'error' ? (
        <p className="text-xs text-[var(--color-danger)]">{state.message}</p>
      ) : null}
    </form>
  );
}
