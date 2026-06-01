'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { useSync } from '../../../_lib/sync-context';
import { SignaturePad, type SignaturePadHandle } from './signature-pad';

// End-of-job customer sign-off, offline-first via the shared queue (type
// 'signoff'). Captures the signature PNG, an internal-only 1–5 rating, any
// verbal feedback, and the email-for-follow-up confirmation.
export function SignoffForm({ jobId, jobNumber }: { jobId: string; jobNumber: string }) {
  const t = useTranslations('workerApp');
  const router = useRouter();
  const { enqueueAction, online } = useSync();
  const padRef = useRef<SignaturePadHandle>(null);
  const [phase, setPhase] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const pad = padRef.current;
    if (!pad || pad.isEmpty()) {
      setError(t('signoff.signatureRequired'));
      return;
    }
    setError(null);
    setPhase('saving');
    const fd = new FormData(e.currentTarget);
    const clientEventId = globalThis.crypto.randomUUID();
    await enqueueAction({
      client_event_id: clientEventId,
      type: 'signoff',
      endpoint: '/api/worker/signoff',
      description: `${t('signoff.heading')} · ${jobNumber}`,
      attempts: 0,
      created_at: Date.now(),
      last_attempt_at: null,
      payload: {
        job_id: jobId,
        client_event_id: clientEventId,
        signature_data_url: pad.toDataUrl(),
        internal_rating_1_5: String(fd.get('internal_rating_1_5') ?? ''),
        feedback_text: String(fd.get('feedback_text') ?? ''),
        email_confirmed: fd.get('email_confirmed') === 'on',
        client_recorded_at: new Date().toISOString(),
      },
    });
    setPhase('saved');
    if (online) router.refresh();
  }

  if (phase === 'saved') {
    return (
      <p className="rounded-md bg-[var(--color-success,#16a34a)]/15 px-3 py-2 text-sm text-[var(--color-success,#16a34a)]">
        {online ? t('signoff.submitted') : t('signoff.queued')}
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <SignaturePad ref={padRef} label={t('signoff.signature')} clearLabel={t('signoff.clear')} />

      <label className="flex flex-col gap-1 text-sm">
        {t('signoff.rating')}
        <select
          name="internal_rating_1_5"
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
        <span className="text-xs text-[var(--color-muted-foreground)]">
          {t('signoff.ratingHint')}
        </span>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        {t('signoff.feedback')}
        <textarea name="feedback_text" rows={3} className="rounded-md border px-3 py-2" />
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="email_confirmed" className="h-4 w-4" />
        {t('signoff.emailConfirm')}
      </label>

      {error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : null}

      <button
        type="submit"
        disabled={phase === 'saving'}
        className="rounded-lg bg-[var(--color-primary)] px-4 py-3 text-center font-medium text-[var(--color-primary-foreground)] active:opacity-80 disabled:opacity-50"
      >
        {phase === 'saving' ? t('signoff.submitting') : t('signoff.submit')}
      </button>
    </form>
  );
}
