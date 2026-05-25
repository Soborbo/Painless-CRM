'use client';

import {
  INITIAL_PROFIT_REVIEW_STATE,
  type ProfitReviewState,
  submitProfitReview,
} from '@/lib/actions/profit-review';
import type { ProfitReviewStatus } from '@/lib/jobs/profit';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

interface Props {
  jobId: string;
  version: number;
  status: ProfitReviewStatus;
  canFinalise: boolean;
  defaults: {
    actual_crew_cost_pence: number;
    actual_van_cost_pence: number;
    passthrough_costs_pence: number;
  };
}

export function ProfitReviewForm({ jobId, version, status, canFinalise, defaults }: Props) {
  const t = useTranslations('profitReview');
  const [state, formAction, pending] = useActionState<ProfitReviewState, FormData>(
    submitProfitReview,
    INITIAL_PROFIT_REVIEW_STATE,
  );
  const readOnly = status === 'finalized';

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="job_id" value={jobId} />
      <input type="hidden" name="version" value={version} />

      <PenceField
        name="actual_crew_cost_pence"
        label={t('crew')}
        defaultValue={defaults.actual_crew_cost_pence}
        readOnly={readOnly}
      />
      <PenceField
        name="actual_van_cost_pence"
        label={t('van')}
        defaultValue={defaults.actual_van_cost_pence}
        readOnly={readOnly}
      />
      <PenceField
        name="passthrough_costs_pence"
        label={t('passthrough')}
        defaultValue={defaults.passthrough_costs_pence}
        readOnly={readOnly}
      />

      {readOnly ? (
        <p className="text-xs text-[var(--color-muted-foreground)]">{t('lockedHelp')}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          <SubmitButton intent="save" disabled={pending} label={t('save')} />
          <SubmitButton
            intent="mark_reviewed"
            disabled={pending}
            label={status === 'reviewed' ? t('updateReviewed') : t('markReviewed')}
            primary
          />
          {canFinalise ? (
            <SubmitButton
              intent="finalize"
              disabled={pending}
              label={t('finalize')}
              tone="danger"
            />
          ) : null}
        </div>
      )}

      {state.status === 'error' ? (
        <p className="text-sm text-red-600">{t(`error.${state.reason}` as never)}</p>
      ) : null}
      {state.status === 'ok' ? (
        <p className="text-sm text-emerald-700">{t(`ok.${state.intent}` as never)}</p>
      ) : null}
    </form>
  );
}

function PenceField({
  name,
  label,
  defaultValue,
  readOnly,
}: {
  name: string;
  label: string;
  defaultValue: number;
  readOnly: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span>{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-xs text-[var(--color-muted-foreground)]">£</span>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          name={name}
          defaultValue={defaultValue}
          readOnly={readOnly}
          className="w-32 rounded-md border px-2 py-1 font-mono text-sm tabular-nums read-only:bg-[var(--color-muted)]"
        />
        <span className="text-xs text-[var(--color-muted-foreground)]">pence</span>
      </div>
    </label>
  );
}

function SubmitButton({
  intent,
  label,
  disabled,
  primary,
  tone,
}: {
  intent: 'save' | 'mark_reviewed' | 'finalize';
  label: string;
  disabled: boolean;
  primary?: boolean;
  tone?: 'danger';
}) {
  const cls = primary
    ? 'rounded-md border bg-[var(--color-primary)] px-3 py-1.5 text-sm font-medium text-[var(--color-primary-foreground)] hover:opacity-90 disabled:opacity-50'
    : tone === 'danger'
      ? 'rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50'
      : 'rounded-md border px-3 py-1.5 text-sm hover:bg-[var(--color-muted)] disabled:opacity-50';
  return (
    <button type="submit" name="intent" value={intent} disabled={disabled} className={cls}>
      {label}
    </button>
  );
}
