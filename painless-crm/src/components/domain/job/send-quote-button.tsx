'use client';

import { INITIAL_SEND_QUOTE_STATE, type SendQuoteState, sendQuote } from '@/lib/actions/quotes';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

export function SendQuoteButton({ quoteId, version }: { quoteId: string; version: number }) {
  const t = useTranslations('quotes');
  const tc = useTranslations('common');
  const [state, formAction, pending] = useActionState<SendQuoteState, FormData>(
    sendQuote,
    INITIAL_SEND_QUOTE_STATE,
  );

  if (state.status === 'ok') {
    return (
      <div className="flex flex-col gap-2 rounded-md border bg-[var(--color-muted)] p-3 text-xs">
        <span className="font-semibold">{t('sentLinkLabel')}</span>
        <input
          readOnly
          value={state.share_url}
          className="rounded-md border bg-white px-2 py-1 font-mono text-[11px]"
          onFocus={(e) => e.currentTarget.select()}
        />
        <span className="text-[var(--color-muted-foreground)]">{t('sentLinkHelp')}</span>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-1">
      <input type="hidden" name="quote_id" value={quoteId} />
      <input type="hidden" name="version" value={version} />
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md border px-2 py-1 text-xs font-medium hover:bg-[var(--color-muted)] disabled:opacity-50"
      >
        {pending ? tc('loading') : t('sendButton')}
      </button>
      {state.status === 'error' ? <p className="text-xs text-red-600">{state.message}</p> : null}
    </form>
  );
}
