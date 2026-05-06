'use client';

import {
  INITIAL_WITHDRAW_QUOTE_STATE,
  type WithdrawQuoteState,
  withdrawQuote,
} from '@/lib/actions/quote-withdrawal';
import { useTranslations } from 'next-intl';
import { useActionState, useState } from 'react';

interface Props {
  quoteId: string;
}

export function WithdrawQuoteButton({ quoteId }: Props) {
  const t = useTranslations('quotes');
  const [expanded, setExpanded] = useState(false);
  const [state, formAction, pending] = useActionState<WithdrawQuoteState, FormData>(
    withdrawQuote,
    INITIAL_WITHDRAW_QUOTE_STATE,
  );

  if (state.status === 'ok') return null;

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
      >
        {t('withdrawAction')}
      </button>
    );
  }

  return (
    <form action={formAction} className="flex w-full flex-col gap-2 rounded-md border p-3">
      <input type="hidden" name="quote_id" value={quoteId} />
      <label className="flex flex-col gap-1 text-xs">
        {t('withdrawReasonLabel')}
        <input
          type="text"
          name="reason"
          maxLength={500}
          placeholder={t('withdrawReasonPlaceholder')}
          className="rounded-md border px-2 py-1 text-sm"
        />
      </label>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
        >
          {pending ? t('withdrawing') : t('withdrawConfirm')}
        </button>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          disabled={pending}
          className="rounded-md px-2 py-1 text-xs text-[var(--color-muted-foreground)] hover:underline"
        >
          {t('withdrawCancel')}
        </button>
      </div>
      {state.status === 'error' ? (
        <p className="text-xs text-red-600">{t(`withdrawError.${state.reason}` as never)}</p>
      ) : null}
    </form>
  );
}
