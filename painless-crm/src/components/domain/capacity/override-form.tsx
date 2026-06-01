'use client';

import { setCapacityOverride } from '@/lib/actions/capacity';
import {
  type CapacityOverrideState,
  INITIAL_CAPACITY_OVERRIDE_STATE,
} from '@/lib/actions/capacity-state';
import { CAPACITY_BANDS } from '@/lib/capacity/band';
import { useTranslations } from 'next-intl';
import { useActionState, useRef } from 'react';

export function OverrideForm() {
  const t = useTranslations('capacity');
  const tc = useTranslations('common');
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<CapacityOverrideState, FormData>(
    async (prev, fd) => {
      const next = await setCapacityOverride(prev, fd);
      if (next.status === 'ok') formRef.current?.reset();
      return next;
    },
    INITIAL_CAPACITY_OVERRIDE_STATE,
  );

  return (
    <form
      ref={formRef}
      action={action}
      className="flex flex-col gap-3 rounded-md border p-4 text-sm"
    >
      <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
        {t('overrideTitle')}
      </h3>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          {t('overrideDate')}
          <input type="date" name="date" required className="rounded-md border px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1">
          {t('overrideBand')}
          <select name="forced_band" required className="rounded-md border px-3 py-2">
            {CAPACITY_BANDS.map((b) => (
              <option key={b} value={b}>
                {t(`bands.${b}` as never)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-1 flex-col gap-1">
          {t('overrideReason')}
          <input
            type="text"
            name="reason"
            required
            minLength={3}
            maxLength={500}
            placeholder={t('overrideReasonPlaceholder')}
            className="rounded-md border px-3 py-2"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md border bg-[var(--color-primary)] px-3 py-2 font-medium text-[var(--color-primary-foreground)] disabled:opacity-50"
        >
          {pending ? tc('loading') : t('overrideApply')}
        </button>
      </div>
      {state.status === 'ok' ? (
        <span className="text-xs text-green-700">{t('overrideSaved')}</span>
      ) : null}
      {state.status === 'error' ? (
        <span className="text-xs text-red-600">{state.message}</span>
      ) : null}
    </form>
  );
}
