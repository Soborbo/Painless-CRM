'use client';

import {
  INITIAL_CUSTOMISATION_STATE,
  type CustomisationState,
  saveDocumentText,
} from '@/lib/actions/customisation';
import type { DocumentText } from '@/lib/customisation/document-text';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

export function DocumentTextForm({ text }: { text: DocumentText }) {
  const t = useTranslations('documentText');
  const [state, action, pending] = useActionState<CustomisationState, FormData>(
    saveDocumentText,
    INITIAL_CUSTOMISATION_STATE,
  );

  return (
    <form action={action} className="mt-6 flex flex-col gap-5">
      <Field
        name="acceptance_terms"
        label={t('acceptanceTerms')}
        hint={t('acceptanceTermsHint')}
        defaultValue={text.acceptance_terms}
      />
      <Field
        name="signoff_declaration"
        label={t('signoffDeclaration')}
        hint={t('signoffDeclarationHint')}
        defaultValue={text.signoff_declaration}
      />
      <Field
        name="quote_footer"
        label={t('quoteFooter')}
        hint={t('quoteFooterHint')}
        defaultValue={text.quote_footer}
      />

      {state.status === 'error' ? <p className="text-sm text-red-600">{state.message}</p> : null}
      {state.status === 'ok' ? <p className="text-sm text-emerald-600">{t('saved')}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md border bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-foreground)] disabled:opacity-50"
      >
        {pending ? t('saving') : t('save')}
      </button>
    </form>
  );
}

function Field({
  name,
  label,
  hint,
  defaultValue,
}: {
  name: string;
  label: string;
  hint: string;
  defaultValue: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      <span className="text-xs text-[var(--color-muted-foreground)]">{hint}</span>
      <textarea
        name={name}
        rows={4}
        maxLength={8000}
        defaultValue={defaultValue}
        className="mt-1 rounded-md border px-3 py-2 text-sm"
      />
    </label>
  );
}
