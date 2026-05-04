'use client';

import { type JobActionState, transitionJobStage } from '@/lib/actions/jobs';
import { ALLOWED_FORWARD_TRANSITIONS, type JobStage } from '@/lib/jobs/state-machine';
import { useTranslations } from 'next-intl';
import { useActionState, useState } from 'react';

const INITIAL: JobActionState = { status: 'idle' };

const SAFE_QUICK_STAGES: JobStage[] = [
  'contacted',
  'survey_scheduled',
  'quoted',
  'accepted',
  'confirmed',
  'in_progress',
  'completed',
  'invoiced',
  'paid',
];

export function QuickStageMenu({
  id,
  version,
  stage,
}: {
  id: string;
  version: number;
  stage: JobStage;
}) {
  const t = useTranslations('jobs');
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(transitionJobStage, INITIAL);
  const targets = ALLOWED_FORWARD_TRANSITIONS[stage].filter((s) => SAFE_QUICK_STAGES.includes(s));

  if (targets.length === 0) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="rounded-md border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide hover:bg-[var(--color-muted)]"
      >
        {t('quickMove')}
      </button>
      {open ? (
        <ul
          role="menu"
          className="absolute right-0 z-20 mt-1 w-44 rounded-md border bg-[var(--color-background)] p-1 text-sm shadow-md"
        >
          {targets.map((target) => (
            <li key={target}>
              <form action={action} onSubmit={() => setOpen(false)}>
                <input type="hidden" name="id" value={id} />
                <input type="hidden" name="version" value={version} />
                <input type="hidden" name="target_stage" value={target} />
                <button
                  type="submit"
                  disabled={pending}
                  className="w-full rounded-sm px-2 py-1 text-left text-xs hover:bg-[var(--color-muted)] disabled:opacity-50"
                >
                  → {t(`stages.${target}`)}
                </button>
              </form>
            </li>
          ))}
        </ul>
      ) : null}
      {state.status === 'error' ? (
        <p className="absolute right-0 top-full mt-1 w-48 text-[10px] text-[var(--color-danger)]">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
