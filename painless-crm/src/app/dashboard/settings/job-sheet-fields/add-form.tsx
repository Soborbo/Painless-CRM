'use client';

import {
  INITIAL_CF_STATE,
  type CustomFieldActionState,
  addJobSheetField,
} from '@/lib/actions/custom-fields';
import { CUSTOM_FIELD_TYPES } from '@/lib/custom-fields/defs';
import { useTranslations } from 'next-intl';
import { useActionState, useRef } from 'react';

export function AddJobSheetFieldForm() {
  const t = useTranslations('jobSheetFields');
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<CustomFieldActionState, FormData>(
    async (prev, fd) => {
      const next = await addJobSheetField(prev, fd);
      if (next.status === 'ok') formRef.current?.reset();
      return next;
    },
    INITIAL_CF_STATE,
  );
  const field = 'rounded-md border px-2 py-1.5 text-sm';

  return (
    <form ref={formRef} action={action} className="mt-2 flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-xs">
          {t('label')}
          <input name="label" required maxLength={80} className={field} />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          {t('key')}
          <input name="key" required placeholder="e.g. parking_permit" className={`${field} font-mono`} />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          {t('type')}
          <select name="type" defaultValue="text" className={field}>
            {CUSTOM_FIELD_TYPES.map((ty) => (
              <option key={ty} value={ty}>
                {t(`type_${ty}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs">
          {t('options')}
          <input name="options" placeholder={t('optionsHint')} className={field} />
        </label>
      </div>
      <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" name="required" className="h-4 w-4" />
        {t('requiredToggle')}
      </label>

      {state.status === 'error' ? <p className="text-xs text-red-600">{state.message}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md border bg-[var(--color-primary)] px-3 py-1.5 text-xs font-medium text-[var(--color-primary-foreground)] disabled:opacity-50"
      >
        {pending ? t('saving') : t('addField')}
      </button>
    </form>
  );
}
