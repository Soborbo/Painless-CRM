'use client';

import { INITIAL_NOTE_ACTION_STATE, type NoteActionState, addJobNote } from '@/lib/actions/notes';
import { useTranslations } from 'next-intl';
import { useActionState, useRef } from 'react';

export function AddNoteForm({ jobId }: { jobId: string }) {
  const t = useTranslations('notes');
  const tc = useTranslations('common');
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<NoteActionState, FormData>(
    async (prev, fd) => {
      const next = await addJobNote(prev, fd);
      if (next.status === 'ok') formRef.current?.reset();
      return next;
    },
    INITIAL_NOTE_ACTION_STATE,
  );

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="job_id" value={jobId} />
      <textarea
        name="body"
        rows={3}
        maxLength={8000}
        required
        placeholder={t('placeholder')}
        className="rounded-md border px-3 py-2 text-sm"
      />
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs">
          <span>{t('categoryLabel')}</span>
          <select name="category" defaultValue="admin" className="rounded-md border px-2 py-1 text-xs">
            <option value="admin">{t('categoryAdmin')}</option>
            <option value="staff">{t('categoryStaff')}</option>
            <option value="customer_visible">{t('categoryCustomerVisible')}</option>
          </select>
        </label>
        <span className="text-[11px] text-[var(--color-muted-foreground)]">
          {t('visibilityHelp')}
        </span>
        <button
          type="submit"
          disabled={pending}
          className="ml-auto rounded-md border bg-[var(--color-primary)] px-3 py-1.5 text-xs font-medium text-[var(--color-primary-foreground)] disabled:opacity-50"
        >
          {pending ? tc('loading') : t('submit')}
        </button>
      </div>
      {state.status === 'error' ? <p className="text-xs text-red-600">{state.message}</p> : null}
    </form>
  );
}
