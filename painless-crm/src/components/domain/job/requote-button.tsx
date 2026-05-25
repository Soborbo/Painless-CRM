'use client';

import { INITIAL_REQUOTE_STATE, type RequoteJobState, requoteJob } from '@/lib/actions/requote';
import { useTranslations } from 'next-intl';
import { useActionState, useState } from 'react';

interface Props {
  jobId: string;
}

export function RequoteButton({ jobId }: Props) {
  const t = useTranslations('jobs');
  const [expanded, setExpanded] = useState(false);
  const [state, formAction, pending] = useActionState<RequoteJobState, FormData>(
    requoteJob,
    INITIAL_REQUOTE_STATE,
  );

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="rounded-md border px-3 py-1.5 text-sm hover:bg-[var(--color-muted)]"
      >
        {t('requote.action')}
      </button>
    );
  }

  return (
    <form action={formAction} className="flex w-full max-w-md flex-col gap-2 rounded-md border p-3">
      <input type="hidden" name="source_job_id" value={jobId} />
      <p className="text-xs text-[var(--color-muted-foreground)]">{t('requote.help')}</p>
      <label className="flex flex-col gap-1 text-xs">
        {t('requote.moveDateLabel')}
        <input type="date" name="move_date" className="rounded-md border px-2 py-1 text-sm" />
      </label>
      <label className="flex flex-col gap-1 text-xs">
        {t('requote.notesLabel')}
        <textarea
          name="notes"
          maxLength={4000}
          rows={2}
          placeholder={t('requote.notesPlaceholder')}
          className="rounded-md border px-2 py-1 text-sm"
        />
      </label>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md border bg-[var(--color-primary)] px-3 py-1 text-xs font-medium text-[var(--color-primary-foreground)] hover:opacity-90 disabled:opacity-50"
        >
          {pending ? t('requote.working') : t('requote.confirm')}
        </button>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          disabled={pending}
          className="rounded-md px-2 py-1 text-xs text-[var(--color-muted-foreground)] hover:underline"
        >
          {t('requote.cancel')}
        </button>
      </div>
      {state.status === 'error' ? (
        <p className="text-xs text-red-600">{t(`requote.error.${state.reason}` as never)}</p>
      ) : null}
    </form>
  );
}
