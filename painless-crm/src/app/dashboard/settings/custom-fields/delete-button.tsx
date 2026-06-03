'use client';

import {
  INITIAL_CF_STATE,
  deleteCustomFieldDef,
} from '@/lib/actions/custom-fields';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

export function DeleteDefButton({ fieldKey }: { fieldKey: string }) {
  const t = useTranslations('customFields');
  const [, action, pending] = useActionState(deleteCustomFieldDef, INITIAL_CF_STATE);

  return (
    <form action={action}>
      <input type="hidden" name="key" value={fieldKey} />
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
