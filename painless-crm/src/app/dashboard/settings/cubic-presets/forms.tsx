'use client';

import {
  type CustomisationState,
  INITIAL_CUSTOMISATION_STATE,
  addCubicPreset,
  deleteCubicPreset,
} from '@/lib/actions/customisation';
import { useTranslations } from 'next-intl';
import { useActionState, useRef } from 'react';

export function AddPresetForm() {
  const t = useTranslations('cubicPresets');
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<CustomisationState, FormData>(
    async (prev, fd) => {
      const next = await addCubicPreset(prev, fd);
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
        {t('cubicFtLabel')}
        <input
          name="cubic_ft"
          type="number"
          step="0.1"
          min={0}
          required
          className={`${field} w-28`}
        />
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

export function DeletePresetButton({ name }: { name: string }) {
  const t = useTranslations('cubicPresets');
  const [, action, pending] = useActionState(deleteCubicPreset, INITIAL_CUSTOMISATION_STATE);
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
