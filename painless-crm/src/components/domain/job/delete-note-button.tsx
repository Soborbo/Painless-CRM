'use client';

import {
  INITIAL_NOTE_ACTION_STATE,
  type NoteActionState,
  softDeleteJobNote,
} from '@/lib/actions/notes';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

export function DeleteNoteButton({ noteId, jobId }: { noteId: string; jobId: string }) {
  const t = useTranslations('notes');
  const [state, formAction, pending] = useActionState<NoteActionState, FormData>(
    softDeleteJobNote,
    INITIAL_NOTE_ACTION_STATE,
  );

  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="id" value={noteId} />
      <input type="hidden" name="job_id" value={jobId} />
      <button
        type="submit"
        disabled={pending}
        className="text-xs text-[var(--color-muted-foreground)] hover:text-red-600 disabled:opacity-50"
        aria-label={t('delete')}
      >
        {state.status === 'error' ? t('deleteRetry') : t('delete')}
      </button>
    </form>
  );
}
