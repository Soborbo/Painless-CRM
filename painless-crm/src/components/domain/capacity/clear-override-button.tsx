'use client';

import { clearCapacityOverride } from '@/lib/actions/capacity';
import {
  type CapacityOverrideState,
  INITIAL_CAPACITY_OVERRIDE_STATE,
} from '@/lib/actions/capacity-state';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

export function ClearOverrideButton({ date }: { date: string }) {
  const t = useTranslations('capacity');
  const [, action, pending] = useActionState<CapacityOverrideState, FormData>(
    clearCapacityOverride,
    INITIAL_CAPACITY_OVERRIDE_STATE,
  );

  return (
    <form action={action} className="inline">
      <input type="hidden" name="date" value={date} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border px-2 py-1 text-xs hover:bg-[var(--color-muted)] disabled:opacity-50"
      >
        {t('overrideClear')}
      </button>
    </form>
  );
}
