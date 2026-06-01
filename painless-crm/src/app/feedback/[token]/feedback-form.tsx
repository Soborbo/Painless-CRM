'use client';

import { useState } from 'react';

// Public complaints form. Posts to the token-scoped API route; no auth, no
// satisfaction signal collected (compliance — this is a complaints channel,
// not a survey). Photos deferred (Storage bucket).
export function FeedbackForm({ token }: { token: string }) {
  const [phase, setPhase] = useState<'idle' | 'saving' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const description = String(fd.get('description') ?? '').trim();
    if (description === '') {
      setError('Please tell us what went wrong.');
      return;
    }
    setError(null);
    setPhase('saving');
    const res = await fetch(`/api/feedback/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description,
        severity_self_assessed: String(fd.get('severity_self_assessed') ?? 'needs_fix'),
        preferred_resolution: String(fd.get('preferred_resolution') ?? ''),
        contact_method: String(fd.get('contact_method') ?? ''),
      }),
    });
    if (res.ok) {
      setPhase('done');
    } else {
      setPhase('idle');
      setError(
        res.status === 429
          ? 'Too many submissions — please try again later.'
          : 'Something went wrong. Please try again.',
      );
    }
  }

  if (phase === 'done') {
    return (
      <p className="rounded-md bg-[var(--color-success,#16a34a)]/15 px-4 py-3 text-sm text-[var(--color-success,#16a34a)]">
        Thank you — we’ve received your feedback and will be in touch within 24 hours.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        <span>What went wrong? *</span>
        <textarea name="description" rows={5} required className="rounded-md border px-3 py-2" />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span>How would you describe it?</span>
        <select
          name="severity_self_assessed"
          defaultValue="needs_fix"
          className="rounded-md border bg-transparent px-3 py-2"
        >
          <option value="minor">Minor inconvenience</option>
          <option value="needs_fix">Something needs fixing</option>
          <option value="major">Major problem</option>
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span>What would put it right? (optional)</span>
        <textarea name="preferred_resolution" rows={2} className="rounded-md border px-3 py-2" />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span>Best way and time to reach you (optional)</span>
        <input name="contact_method" className="rounded-md border px-3 py-2" />
      </label>

      {error ? <p className="text-sm text-[var(--color-danger,#dc2626)]">{error}</p> : null}

      <button
        type="submit"
        disabled={phase === 'saving'}
        className="rounded-lg bg-[var(--color-primary)] px-4 py-3 text-center font-medium text-[var(--color-primary-foreground)] active:opacity-80 disabled:opacity-50"
      >
        {phase === 'saving' ? 'Sending…' : 'Send feedback'}
      </button>
    </form>
  );
}
