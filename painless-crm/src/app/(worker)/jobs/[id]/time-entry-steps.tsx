'use client';

import { type StepState, type TimeEntryStep, buildStepStates } from '@/lib/worker/time-entry-steps';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useSync } from '../../_lib/sync-context';

// Job-progress stepper (Phase 09 deliverable #8). Each step enqueues a
// time-entry action (offline-first, same queue as clock-in) and reflects what's
// already recorded. Steps aren't hard-gated in order — a crew can log out of
// sequence — but they render in order with recorded ones checked off.
export function TimeEntrySteps({
  jobId,
  jobNumber,
  recorded,
}: {
  jobId: string;
  jobNumber: string;
  recorded: { type: string | null; occurred_at: string }[];
}) {
  const t = useTranslations('workerApp');
  const router = useRouter();
  const { enqueueAction, online } = useSync();
  // Optimistic local record of steps logged this session (before a refresh).
  const [justLogged, setJustLogged] = useState<Set<TimeEntryStep>>(new Set());
  const [busy, setBusy] = useState<TimeEntryStep | null>(null);

  const states = buildStepStates(recorded);

  async function logStep(step: TimeEntryStep) {
    setBusy(step);
    const clientEventId = globalThis.crypto.randomUUID();
    await enqueueAction({
      client_event_id: clientEventId,
      type: 'time_entry',
      endpoint: '/api/worker/time-entry',
      description: `${t(`steps.${step}`)} · ${jobNumber}`,
      attempts: 0,
      created_at: Date.now(),
      last_attempt_at: null,
      payload: {
        job_id: jobId,
        client_event_id: clientEventId,
        type: step,
        client_recorded_at: new Date().toISOString(),
      },
    });
    setJustLogged((prev) => new Set(prev).add(step));
    setBusy(null);
    if (online) router.refresh();
  }

  return (
    <ul className="flex flex-col gap-2">
      {states.map((s) => (
        <StepRow
          key={s.type}
          state={s}
          logged={justLogged.has(s.type)}
          busy={busy === s.type}
          label={t(`steps.${s.type}`)}
          loggedLabel={t('recorded')}
          actionLabel={t('logStep')}
          onLog={() => logStep(s.type)}
        />
      ))}
    </ul>
  );
}

function StepRow({
  state,
  logged,
  busy,
  label,
  loggedLabel,
  actionLabel,
  onLog,
}: {
  state: StepState;
  logged: boolean;
  busy: boolean;
  label: string;
  loggedLabel: string;
  actionLabel: string;
  onLog: () => void;
}) {
  const done = state.recordedAt !== null || logged;
  return (
    <li className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
      <span className={done ? 'text-[var(--color-muted-foreground)] line-through' : ''}>
        {label}
      </span>
      {done ? (
        <span className="text-xs font-medium text-[var(--color-success,#16a34a)]">
          {state.recordedAt ? `${loggedLabel} ${state.recordedAt.slice(11, 16)}` : loggedLabel}
        </span>
      ) : (
        <button
          type="button"
          onClick={onLog}
          disabled={busy}
          className="rounded-md border px-3 py-1 text-xs font-medium active:bg-[var(--color-muted)] disabled:opacity-50"
        >
          {actionLabel}
        </button>
      )}
    </li>
  );
}
