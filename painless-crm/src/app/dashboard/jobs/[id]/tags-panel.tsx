'use client';

import { type JobActionState, addJobTag, removeJobTag } from '@/lib/actions/jobs';
import { useTranslations } from 'next-intl';
import { useActionState, useRef } from 'react';

const INITIAL: JobActionState = { status: 'idle' };

export function TagsPanel({ jobId, tags }: { jobId: string; tags: string[] }) {
  const t = useTranslations('jobs');
  const tc = useTranslations('common');
  const [addState, addAction, addPending] = useActionState(addJobTag, INITIAL);
  const [, removeAction, removePending] = useActionState(removeJobTag, INITIAL);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="rounded-md border p-4">
      <h3 className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
        {t('tags')}
      </h3>
      <div className="mt-3 flex flex-wrap gap-2">
        {tags.length === 0 ? (
          <span className="text-sm text-[var(--color-muted-foreground)]">{t('noTags')}</span>
        ) : (
          tags.map((tag) => (
            <form key={tag} action={removeAction} className="inline-flex">
              <input type="hidden" name="job_id" value={jobId} />
              <input type="hidden" name="tag" value={tag} />
              <button
                type="submit"
                disabled={removePending}
                title={t('removeTag')}
                className="inline-flex items-center gap-1 rounded-full bg-[var(--color-muted)] px-2 py-0.5 text-xs hover:bg-[var(--color-danger)]/10 disabled:opacity-50"
              >
                <span>{tag}</span>
                <span aria-hidden>×</span>
              </button>
            </form>
          ))
        )}
      </div>

      <form
        action={(form) => {
          addAction(form);
          inputRef.current?.focus();
          if (inputRef.current) inputRef.current.value = '';
        }}
        className="mt-3 flex gap-2 text-sm"
      >
        <input type="hidden" name="job_id" value={jobId} />
        <input
          ref={inputRef}
          name="tag"
          placeholder={t('addTagPlaceholder')}
          maxLength={40}
          className="flex-1 rounded-md border px-3 py-1.5 outline-none focus:ring-2"
        />
        <button
          type="submit"
          disabled={addPending}
          className="rounded-md border px-3 py-1.5 hover:bg-[var(--color-muted)] disabled:opacity-50"
        >
          {addPending ? tc('loading') : t('addTag')}
        </button>
      </form>
      {addState.status === 'error' ? (
        <p className="mt-2 text-xs text-[var(--color-danger)]">{addState.message}</p>
      ) : null}
    </div>
  );
}
