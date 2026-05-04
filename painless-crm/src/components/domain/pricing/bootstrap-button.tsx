'use client';

import {
  type BootstrapState,
  INITIAL_BOOTSTRAP_STATE,
  bootstrapSmokePricing,
} from '@/lib/actions/pricing';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

export function BootstrapButton() {
  const t = useTranslations('pricing');
  const tc = useTranslations('common');
  const [state, formAction, pending] = useActionState<BootstrapState, FormData>(
    async () => bootstrapSmokePricing(),
    INITIAL_BOOTSTRAP_STATE,
  );

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md border px-4 py-2 text-sm font-medium hover:bg-[var(--color-muted)] disabled:opacity-50"
      >
        {pending ? tc('loading') : t('seedSmoke')}
      </button>
      {state.status === 'error' && <p className="text-sm text-red-600">{state.message}</p>}
      {state.status === 'noop' && (
        <p className="text-sm text-[var(--color-muted-foreground)]">{t('alreadySeeded')}</p>
      )}
      {state.status === 'ok' && (
        <p className="text-sm text-green-700">{t('seeded', { broadcast: state.broadcast })}</p>
      )}
    </form>
  );
}
