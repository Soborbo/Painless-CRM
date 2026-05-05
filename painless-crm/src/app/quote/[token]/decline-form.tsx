'use client';

import {
  type DeclineQuoteState,
  INITIAL_DECLINE_QUOTE_STATE,
  declineQuote,
} from '@/lib/actions/quote-decline';
import { useTranslations } from 'next-intl';
import { useActionState, useState } from 'react';

interface Props {
  token: string;
}

const REASON_KEYS: Record<string, string> = {
  invalid_token: 'invalidLink',
  expired_token: 'expiredLink',
  not_found: 'notFound',
  already_accepted: 'alreadyAcceptedTitle',
  expired_validity: 'expiredTitle',
  declined: 'declinedTitle',
  expired_status: 'expiredTitle',
  unknown: 'tryAgain',
};

export function DeclineQuoteForm({ token }: Props) {
  const t = useTranslations('publicQuote');
  const [expanded, setExpanded] = useState(false);
  const [state, formAction, pending] = useActionState<DeclineQuoteState, FormData>(
    declineQuote,
    INITIAL_DECLINE_QUOTE_STATE,
  );

  if (state.status === 'ok') {
    return (
      <section className="rounded-md border border-dashed p-6">
        <h2 className="text-lg font-semibold">{t('declineThanksTitle')}</h2>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          {t('declineThanksBody')}
        </p>
      </section>
    );
  }

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="self-start text-xs text-[var(--color-muted-foreground)] underline hover:text-[var(--color-foreground)]"
      >
        {t('declineToggle')}
      </button>
    );
  }

  return (
    <form action={formAction} className="rounded-md border border-dashed p-6">
      <input type="hidden" name="token" value={token} />
      <h2 className="text-base font-semibold">{t('declineFormTitle')}</h2>
      <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{t('declineFormIntro')}</p>

      <label className="mt-4 flex flex-col gap-1 text-sm">
        {t('declineReasonLabel')}
        <textarea
          name="reason"
          rows={3}
          maxLength={500}
          placeholder={t('declineReasonPlaceholder')}
          className="rounded-md border px-3 py-2"
        />
      </label>

      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-[var(--color-muted)] disabled:opacity-50"
        >
          {pending ? t('declining') : t('declineButton')}
        </button>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          disabled={pending}
          className="rounded-md px-3 py-2 text-sm text-[var(--color-muted-foreground)] hover:underline"
        >
          {t('declineCancel')}
        </button>
      </div>

      {state.status === 'error' ? (
        <p className="mt-3 text-sm text-red-600">{t(REASON_KEYS[state.reason] ?? 'tryAgain')}</p>
      ) : null}
    </form>
  );
}
