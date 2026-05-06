'use client';

import {
  INITIAL_VARIANT_STATE,
  type VariantActionState,
  addVariant,
  removeVariant,
} from '@/lib/actions/quote-variants';
import type { QuoteVariantRow } from '@/lib/queries/quote-variants';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

interface Props {
  quoteId: string;
  variants: QuoteVariantRow[];
  canEdit: boolean;
}

export function VariantsEditor({ quoteId, variants, canEdit }: Props) {
  const t = useTranslations('variants');
  const [addState, addAction, addPending] = useActionState<VariantActionState, FormData>(
    addVariant,
    INITIAL_VARIANT_STATE,
  );
  const [removeState, removeAction, removePending] = useActionState<VariantActionState, FormData>(
    removeVariant,
    INITIAL_VARIANT_STATE,
  );

  return (
    <div className="flex flex-col gap-3">
      {variants.length === 0 ? (
        <p className="text-sm text-[var(--color-muted-foreground)]">{t('empty')}</p>
      ) : (
        <ul className="flex flex-col divide-y">
          {variants.map((v) => (
            <li key={v.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
              <div className="flex flex-col">
                <span className="font-medium">{v.variant_label}</span>
                {v.description ? (
                  <span className="text-xs text-[var(--color-muted-foreground)]">
                    {v.description}
                  </span>
                ) : null}
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm">
                  £{(v.total_pence / 100).toLocaleString('en-GB')}
                </span>
                {canEdit ? (
                  <form action={removeAction}>
                    <input type="hidden" name="quote_id" value={quoteId} />
                    <input type="hidden" name="variant_id" value={v.id} />
                    <button
                      type="submit"
                      disabled={removePending}
                      className="text-xs text-red-600 hover:underline disabled:opacity-50"
                    >
                      {removePending ? t('removing') : t('remove')}
                    </button>
                  </form>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {canEdit ? (
        <form
          action={addAction}
          className="flex flex-col gap-2 rounded-md border border-dashed p-3"
        >
          <input type="hidden" name="quote_id" value={quoteId} />
          <p className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
            {t('addTitle')}
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <label className="flex flex-col gap-1 text-xs sm:col-span-2">
              {t('label')}
              <input
                type="text"
                name="variant_label"
                required
                maxLength={80}
                placeholder={t('labelPlaceholder')}
                className="rounded-md border px-2 py-1 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              {t('totalPence')}
              <input
                type="number"
                name="total_pence"
                required
                min={0}
                max={10_000_000}
                placeholder="120000"
                className="rounded-md border px-2 py-1 text-sm font-mono"
              />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-xs">
            {t('description')}
            <input
              type="text"
              name="description"
              maxLength={500}
              placeholder={t('descriptionPlaceholder')}
              className="rounded-md border px-2 py-1 text-sm"
            />
          </label>
          <div>
            <button
              type="submit"
              disabled={addPending}
              className="rounded-md border bg-[var(--color-primary)] px-3 py-1 text-xs font-medium text-[var(--color-primary-foreground)] disabled:opacity-50"
            >
              {addPending ? t('adding') : t('add')}
            </button>
          </div>
          {addState.status === 'error' ? (
            <p className="text-xs text-red-600">{t(`error.${addState.reason}` as never)}</p>
          ) : null}
        </form>
      ) : null}
      {removeState.status === 'error' ? (
        <p className="text-xs text-red-600">{t(`error.${removeState.reason}` as never)}</p>
      ) : null}
    </div>
  );
}
