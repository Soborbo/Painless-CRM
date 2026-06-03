'use client';

import {
  INITIAL_CF_STATE,
  type CustomFieldActionState,
  saveJobCustomFields,
} from '@/lib/actions/custom-fields';
import type { CustomFieldDef } from '@/lib/custom-fields/defs';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

type Values = Record<string, string | number | boolean>;

export function CustomFieldsForm({
  jobId,
  defs,
  values,
}: {
  jobId: string;
  defs: CustomFieldDef[];
  values: Values;
}) {
  const t = useTranslations('customFields');
  const [state, action, pending] = useActionState<CustomFieldActionState, FormData>(
    saveJobCustomFields,
    INITIAL_CF_STATE,
  );
  const field = 'rounded-md border px-2 py-1.5 text-sm';

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="job_id" value={jobId} />
      {defs.map((def) => {
        const name = `cf_${def.key}`;
        const current = values[def.key];
        return (
          <label key={def.key} className="flex flex-col gap-1 text-sm">
            <span className="text-xs text-[var(--color-muted-foreground)]">
              {def.label}
              {def.required ? ' *' : ''}
            </span>
            {def.type === 'select' ? (
              <select name={name} defaultValue={String(current ?? '')} className={field}>
                <option value="">—</option>
                {def.options?.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : def.type === 'checkbox' ? (
              <input type="checkbox" name={name} defaultChecked={current === true} className="h-4 w-4" />
            ) : (
              <input
                type={def.type === 'number' ? 'number' : 'text'}
                name={name}
                defaultValue={current === undefined ? '' : String(current)}
                className={field}
              />
            )}
          </label>
        );
      })}

      {state.status === 'error' ? <p className="text-xs text-red-600">{state.message}</p> : null}
      {state.status === 'ok' ? <p className="text-xs text-emerald-600">{t('saved')}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md border bg-[var(--color-primary)] px-3 py-1.5 text-xs font-medium text-[var(--color-primary-foreground)] disabled:opacity-50"
      >
        {pending ? t('saving') : t('save')}
      </button>
    </form>
  );
}
