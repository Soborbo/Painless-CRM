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
  seed?: {
    source_quote_id: string;
    size_code: string | null;
    distance_miles: number | null;
    complications: string[] | null;
  } | null;
}

export function ManualQuoteForm({ jobId, options, seed }: ManualQuoteFormProps) {
  const t = useTranslations('quotes');
  const tc = useTranslations('common');
  const [state, formAction, pending] = useActionState<QuoteBuilderState, FormData>(
    buildManualQuote,
    INITIAL_QUOTE_BUILDER_STATE,
  );

  const seedSizes = new Set(options.size_categories.map((s) => s.code));
  const defaultSize =
    seed?.size_code && seedSizes.has(seed.size_code)
      ? seed.size_code
      : (options.size_categories[0]?.code ?? '');
  const defaultDistance = seed?.distance_miles ?? 10;
  const seedComplications = new Set(seed?.complications ?? []);

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-md border p-6">
      <input type="hidden" name="job_id" value={jobId} />
      {seed ? <input type="hidden" name="revised_from_id" value={seed.source_quote_id} /> : null}
      <p className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
        {t('builderAgainst')} {options.version_label}
      </p>

      <label className="flex flex-col gap-1 text-sm">
        {t('builderSize')}
        <select
          name="size_code"
          defaultValue={defaultSize}
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
          defaultValue={defaultDistance}
          className="rounded-md border px-3 py-2"
          required
        />
      </label>

      <fieldset className="flex flex-col gap-1 text-sm">
        <legend>{t('builderComplications')}</legend>
        <select
          name="complications"
          multiple
          defaultValue={options.complications
            .filter((c) => seedComplications.has(c.code))
            .map((c) => c.code)}
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
        {pending ? tc('loading') : seed ? t('builderSubmitRevise') : t('builderSubmit')}
      </button>

      {state.status === 'error' && <p className="text-sm text-red-600">{state.message}</p>}
    </form>
  );
}
