'use client';

import {
  INITIAL_CUSTOMISATION_STATE,
  type CustomisationState,
  addLeadProvider,
  deleteLeadProvider,
} from '@/lib/actions/customisation';
import { useTranslations } from 'next-intl';
import { useActionState, useRef } from 'react';

export function AddProviderForm() {
  const t = useTranslations('leadProviders');
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<CustomisationState, FormData>(
    async (prev, fd) => {
      const next = await addLeadProvider(prev, fd);
      if (next.status === 'ok') formRef.current?.reset();
      return next;
    },
    INITIAL_CUSTOMISATION_STATE,
  );
  const field = 'rounded-md border px-2 py-1.5 text-sm';

  return (
    <form ref={formRef} action={action} className="mt-2 flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1 text-xs">
        {t('name')}
        <input name="name" required maxLength={80} className={field} />
      </label>
      <label className="flex flex-col gap-1 text-xs">
        {t('sourceKey')}
        <input name="source_key" required placeholder="compare_my_move" className={`${field} font-mono`} />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border bg-[var(--color-primary)] px-3 py-1.5 text-xs font-medium text-[var(--color-primary-foreground)] disabled:opacity-50"
      >
        {pending ? t('saving') : t('add')}
      </button>
      {state.status === 'error' ? (
        <p className="w-full text-xs text-red-600">{state.message}</p>
      ) : null}
    </form>
  );
}

export function DeleteProviderButton({ name }: { name: string }) {
  const t = useTranslations('leadProviders');
  const [, action, pending] = useActionState(deleteLeadProvider, INITIAL_CUSTOMISATION_STATE);
  return (
    <form action={action}>
      <input type="hidden" name="name" value={name} />
      <button
        type="submit"
        disabled={pending}
        className="text-xs text-[var(--color-muted-foreground)] hover:text-red-600 disabled:opacity-50"
      >
        {t('remove')}
      </button>
    </form>
  );
}
