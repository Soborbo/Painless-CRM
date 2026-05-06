'use client';

import {
  type AcceptQuoteState,
  INITIAL_ACCEPT_QUOTE_STATE,
  acceptQuote,
} from '@/lib/actions/quote-acceptance';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

interface VariantOption {
  id: string;
  label: string;
  total_pence: number;
}

interface Props {
  token: string;
  customerName: string;
  variants?: VariantOption[];
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

function formatPence(pence: number): string {
  return `£${(pence / 100).toLocaleString('en-GB', { maximumFractionDigits: 0 })}`;
}

export function AcceptQuoteForm({ token, customerName, variants = [] }: Props) {
  const t = useTranslations('publicQuote');
  const [state, formAction, pending] = useActionState<AcceptQuoteState, FormData>(
    acceptQuote,
    INITIAL_ACCEPT_QUOTE_STATE,
  );

  if (state.status === 'ok') {
    return (
      <section className="rounded-md border bg-[var(--color-muted)] p-6">
        <h2 className="text-lg font-semibold">{t('thanksTitle')}</h2>
        <p className="mt-1 text-sm">{t('thanksBody')}</p>
      </section>
    );
  }

  return (
    <form action={formAction} className="rounded-md border p-6">
      <input type="hidden" name="token" value={token} />
      <h2 className="text-lg font-semibold">{t('formTitle')}</h2>
      <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{t('formIntro')}</p>

      {variants.length > 0 ? (
        <fieldset className="mt-4 flex flex-col gap-2">
          <legend className="text-sm">{t('chooseVariant')}</legend>
          {variants.map((v, idx) => (
            <label
              key={v.id}
              className="flex cursor-pointer items-baseline gap-2 rounded-md border px-3 py-2 text-sm"
            >
              <input
                type="radio"
                name="variant_id"
                value={v.id}
                defaultChecked={idx === 0}
                required
              />
              <span className="flex-1 font-medium">{v.label}</span>
              <span className="font-mono">{formatPence(v.total_pence)}</span>
            </label>
          ))}
        </fieldset>
      ) : null}

      <label className="mt-4 flex flex-col gap-1 text-sm">
        {t('fullName')}
        <input
          type="text"
          name="full_name"
          defaultValue={customerName}
          required
          maxLength={200}
          className="rounded-md border px-3 py-2"
        />
      </label>

      <label className="mt-4 flex items-start gap-2 text-sm">
        <input type="checkbox" name="consent_terms" required className="mt-1" />
        <span>{t('consentTerms')}</span>
      </label>

      <button
        type="submit"
        disabled={pending}
        className="mt-6 rounded-md bg-[var(--color-primary)] px-5 py-2 text-sm font-medium text-[var(--color-primary-foreground)] disabled:opacity-50"
      >
        {pending ? t('accepting') : t('acceptButton')}
      </button>

      {state.status === 'error' ? (
        <p className="mt-3 text-sm text-red-600">{t(REASON_KEYS[state.reason] ?? 'tryAgain')}</p>
      ) : null}
    </form>
  );
}
