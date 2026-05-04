'use client';

import { type JobActionState, transitionJobStage } from '@/lib/actions/jobs';
import {
  ALLOWED_BACKWARD_TRANSITIONS,
  ALLOWED_FORWARD_TRANSITIONS,
  type JobStage,
} from '@/lib/jobs/state-machine';
import { DECLINE_REASONS, DEPOSIT_REFUND_DECISIONS } from '@/lib/schemas/job';
import { useTranslations } from 'next-intl';
import { useActionState, useState } from 'react';

const INITIAL: JobActionState = { status: 'idle' };

export function StageTransition({
  id,
  version,
  stage,
  isManager,
}: {
  id: string;
  version: number;
  stage: JobStage;
  isManager: boolean;
}) {
  const t = useTranslations('jobs');
  const tc = useTranslations('common');
  const [state, action, pending] = useActionState(transitionJobStage, INITIAL);
  const forward = ALLOWED_FORWARD_TRANSITIONS[stage];
  const backward = ALLOWED_BACKWARD_TRANSITIONS[stage];
  const visibleBackward = isManager ? backward : [];
  const all: { stage: JobStage; backward: boolean }[] = [
    ...forward.map((s) => ({ stage: s, backward: false })),
    ...visibleBackward.map((s) => ({ stage: s, backward: true })),
  ];
  const [target, setTarget] = useState<{ stage: JobStage; backward: boolean } | null>(null);

  if (all.length === 0) {
    return (
      <div className="rounded-md border p-4 text-sm text-[var(--color-muted-foreground)]">
        {t('terminalStage')}
      </div>
    );
  }

  return (
    <div className="rounded-md border p-4">
      <h3 className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
        {t('transitionTitle')}
      </h3>
      <div className="mt-3 flex flex-wrap gap-2">
        {all.map(({ stage: s, backward: rev }) => (
          <button
            key={`${s}-${rev}`}
            type="button"
            onClick={() => setTarget({ stage: s, backward: rev })}
            className={`rounded-md border px-3 py-1.5 text-xs ${
              target?.stage === s
                ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
                : 'hover:bg-[var(--color-muted)]'
            } ${rev ? 'border-[var(--color-warning)]' : ''}`}
          >
            {rev ? '↩ ' : ''}
            {t(`stages.${s}`)}
          </button>
        ))}
      </div>

      {target ? (
        <form action={action} className="mt-4 flex flex-col gap-3">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="version" value={version} />
          <input type="hidden" name="target_stage" value={target.stage} />

          {target.backward ? (
            <label className="flex flex-col gap-1 text-sm">
              {t('revertReason')}
              <input
                name="reason"
                required
                maxLength={500}
                className="rounded-md border px-3 py-2 outline-none focus:ring-2"
              />
            </label>
          ) : (
            <label className="flex flex-col gap-1 text-sm">
              {t('reasonOptional')}
              <input
                name="reason"
                maxLength={500}
                className="rounded-md border px-3 py-2 outline-none focus:ring-2"
              />
            </label>
          )}

          {target.stage === 'declined' ? (
            <label className="flex flex-col gap-1 text-sm">
              {t('declineReason')}
              <select
                name="decline_reason"
                required
                className="rounded-md border bg-transparent px-3 py-2 outline-none focus:ring-2"
              >
                <option value="">—</option>
                {DECLINE_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {t(`declineReasons.${r}`)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {target.stage === 'cancelled' ? (
            <>
              <label className="flex flex-col gap-1 text-sm">
                {t('cancellationReason')}
                <input
                  name="cancellation_reason"
                  required
                  maxLength={500}
                  className="rounded-md border px-3 py-2 outline-none focus:ring-2"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                {t('depositRefundDecision')}
                <select
                  name="deposit_refund_decision"
                  required
                  className="rounded-md border bg-transparent px-3 py-2 outline-none focus:ring-2"
                >
                  <option value="">—</option>
                  {DEPOSIT_REFUND_DECISIONS.map((d) => (
                    <option key={d} value={d}>
                      {t(`refundDecisions.${d}`)}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : null}

          {state.status === 'error' ? (
            <p className="text-sm text-[var(--color-danger)]">{state.message}</p>
          ) : null}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-foreground)] transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {pending ? tc('loading') : t('confirmTransition')}
            </button>
            <button
              type="button"
              onClick={() => setTarget(null)}
              className="rounded-md border px-4 py-2 text-sm hover:bg-[var(--color-muted)]"
            >
              {tc('cancel')}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
