'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useSync } from '../../../_lib/sync-context';

// End-of-job sheet, offline-first via the shared queue (type 'job_sheet').
// Reads the form fields into the queued payload, then enqueues + syncs.
export function SheetForm({ jobId, jobNumber }: { jobId: string; jobNumber: string }) {
  const t = useTranslations('workerApp');
  const router = useRouter();
  const { enqueueAction, online } = useSync();
  const [damage, setDamage] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const actualHours = String(fd.get('actual_hours') ?? '').trim();
    if (actualHours === '') {
      setError(t('sheet.hoursRequired'));
      return;
    }
    setError(null);
    setPhase('saving');
    const clientEventId = globalThis.crypto.randomUUID();
    await enqueueAction({
      client_event_id: clientEventId,
      type: 'job_sheet',
      endpoint: '/api/worker/job-sheet',
      description: `${t('sheet.heading')} · ${jobNumber}`,
      attempts: 0,
      created_at: Date.now(),
      last_attempt_at: null,
      payload: {
        job_id: jobId,
        client_event_id: clientEventId,
        actual_hours: actualHours,
        actual_cubic_ft: String(fd.get('actual_cubic_ft') ?? ''),
        complications_encountered: String(fd.get('complications_encountered') ?? ''),
        damage_reported: damage,
        damage_details: String(fd.get('damage_details') ?? ''),
        customer_satisfaction_score: String(fd.get('customer_satisfaction_score') ?? ''),
        client_recorded_at: new Date().toISOString(),
      },
    });
    setPhase('saved');
    if (online) router.refresh();
  }

  if (phase === 'saved') {
    return (
      <p className="rounded-md bg-[var(--color-success,#16a34a)]/15 px-3 py-2 text-sm text-[var(--color-success,#16a34a)]">
        {online ? t('sheet.submitted') : t('sheet.queued')}
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <Field
        label={t('sheet.actualHours')}
        name="actual_hours"
        type="number"
        step="0.25"
        min={0}
        required
      />
      <Field
        label={t('sheet.actualCubicFt')}
        name="actual_cubic_ft"
        type="number"
        step="any"
        min={0}
      />

      <label className="flex flex-col gap-1 text-sm">
        {t('sheet.complications')}
        <textarea
          name="complications_encountered"
          rows={3}
          className="rounded-md border px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        {t('sheet.satisfaction')}
        <select
          name="customer_satisfaction_score"
          defaultValue=""
          className="rounded-md border bg-transparent px-3 py-2"
        >
          <option value="">—</option>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={damage}
          onChange={(e) => setDamage(e.target.checked)}
          className="h-4 w-4"
        />
        {t('sheet.damageReported')}
      </label>
      {damage ? (
        <label className="flex flex-col gap-1 text-sm">
          {t('sheet.damageDetails')}
          <textarea name="damage_details" rows={2} className="rounded-md border px-3 py-2" />
        </label>
      ) : null}

      {error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : null}

      <button
        type="submit"
        disabled={phase === 'saving'}
        className="rounded-lg bg-[var(--color-primary)] px-4 py-3 text-center font-medium text-[var(--color-primary-foreground)] active:opacity-80 disabled:opacity-50"
      >
        {phase === 'saving' ? t('sheet.submitting') : t('sheet.submit')}
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  type,
  step,
  min,
  required,
}: {
  label: string;
  name: string;
  type: string;
  step?: string;
  min?: number;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span>
        {label}
        {required ? <span className="text-[var(--color-danger)]"> *</span> : null}
      </span>
      <input
        type={type}
        name={name}
        step={step}
        min={min}
        required={required}
        className="rounded-md border px-3 py-2"
      />
    </label>
  );
}
