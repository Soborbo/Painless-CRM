'use client';

import {
  INITIAL_QUOTE_BUILDER_STATE,
  type QuoteBuilderState,
  buildManualQuote,
} from '@/lib/actions/quotes';
import type { PricingConfig } from '@/lib/schemas/pricing';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

interface ManualQuoteFormProps {
  jobId: string;
  options: {
    size_categories: PricingConfig['size_categories'];
    complications: PricingConfig['complications'];
    version_label: string;
  };
}

export function ManualQuoteForm({ jobId, options }: ManualQuoteFormProps) {
  const t = useTranslations('quotes');
  const tc = useTranslations('common');
  const [state, formAction, pending] = useActionState<QuoteBuilderState, FormData>(
    buildManualQuote,
    INITIAL_QUOTE_BUILDER_STATE,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-md border p-6">
      <input type="hidden" name="job_id" value={jobId} />
      <p className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
        {t('builderAgainst')} {options.version_label}
      </p>

      <label className="flex flex-col gap-1 text-sm">
        {t('builderSize')}
        <select
          name="size_code"
          defaultValue={options.size_categories[0]?.code ?? ''}
          className="rounded-md border px-3 py-2"
          required
        >
          {options.size_categories.map((s) => (
            <option key={s.code} value={s.code}>
              {s.label} · {s.crew_size}p · {s.estimated_hours}h
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        {t('builderDistance')}
        <input
          type="number"
          name="distance_miles"
          min={0}
          max={2000}
          defaultValue={10}
          className="rounded-md border px-3 py-2"
          required
        />
      </label>

      <fieldset className="flex flex-col gap-1 text-sm">
        <legend>{t('builderComplications')}</legend>
        <select
          name="complications"
          multiple
          className="h-32 rounded-md border px-3 py-2"
          aria-label={t('builderComplicationsHelp')}
        >
          {options.complications.map((c) => (
            <option key={c.code} value={c.code}>
              {c.label} (+{c.points})
            </option>
          ))}
        </select>
        <span className="text-xs text-[var(--color-muted-foreground)]">
          {t('builderComplicationsHelp')}
        </span>
      </fieldset>

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md border bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-foreground)] disabled:opacity-50"
      >
        {pending ? tc('loading') : t('builderSubmit')}
      </button>

      {state.status === 'error' && <p className="text-sm text-red-600">{state.message}</p>}
    </form>
  );
}
