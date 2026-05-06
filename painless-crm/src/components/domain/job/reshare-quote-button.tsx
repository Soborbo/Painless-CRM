'use client';

import {
  INITIAL_RESHARE_STATE,
  type ReshareQuoteState,
  reshareQuote,
} from '@/lib/actions/quote-share';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

export function ReshareQuoteButton({ quoteId }: { quoteId: string }) {
  const t = useTranslations('quotes');
  const [state, formAction, pending] = useActionState<ReshareQuoteState, FormData>(
    reshareQuote,
    INITIAL_RESHARE_STATE,
  );

  if (state.status === 'ok') {
    return (
      <div className="flex flex-col gap-1 rounded-md border bg-[var(--color-muted)] p-3 text-xs">
        <span className="font-semibold">{t('sentLinkLabel')}</span>
        <input
          readOnly
          value={state.share_url}
          className="rounded-md border bg-white px-2 py-1 font-mono text-[11px]"
          onFocus={(e) => e.currentTarget.select()}
        />
        <span className="text-[var(--color-muted-foreground)]">{t('reshareHelp')}</span>
      </div>
    );
  }

  return (
    <form action={formAction} className="contents">
      <input type="hidden" name="quote_id" value={quoteId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border px-2 py-1 text-xs hover:bg-[var(--color-muted)] disabled:opacity-50"
      >
        {pending ? t('reshareWorking') : t('reshareAction')}
      </button>
      {state.status === 'error' ? (
        <p className="w-full text-xs text-red-600">{t(`reshareError.${state.reason}` as never)}</p>
      ) : null}
    </form>
  );
}
