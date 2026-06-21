'use client';

import { type BulkActionState, bulkAddTag, bulkAssignJobs } from '@/lib/actions/jobs-bulk';
import { useTranslations } from 'next-intl';
import { useActionState, useEffect } from 'react';
import { useJobSelection } from './selection-context';

type Rep = { id: string; full_name: string };
const INITIAL: BulkActionState = { status: 'idle' };

// Floating action bar shown only when rows are selected. Each action posts the
// selected ids as repeated job_id fields and clears the selection on success.
export function JobsBulkToolbar({ reps, canAssign }: { reps: Rep[]; canAssign: boolean }) {
  const t = useTranslations('jobs');
  const { selected, clear } = useJobSelection();
  const ids = [...selected];

  const [assignState, assignAction, assignPending] = useActionState(bulkAssignJobs, INITIAL);
  const [tagState, tagAction, tagPending] = useActionState(bulkAddTag, INITIAL);

  useEffect(() => {
    if (assignState.status === 'ok' || tagState.status === 'ok') clear();
  }, [assignState, tagState, clear]);

  if (ids.length === 0) return null;
  const hiddenIds = ids.map((id) => <input key={id} type="hidden" name="job_id" value={id} />);
  const error =
    assignState.status === 'error'
      ? assignState.message
      : tagState.status === 'error'
        ? tagState.message
        : null;

  return (
    <div className="sticky top-2 z-20 flex flex-wrap items-center gap-3 rounded-lg border bg-[var(--color-card)] px-4 py-2 shadow-sm">
      <span className="text-sm font-medium">{t('bulk.selected', { count: ids.length })}</span>

      {canAssign ? (
        <form action={assignAction} className="flex items-center gap-2">
          {hiddenIds}
          <select
            name="assigned_to_id"
            defaultValue=""
            className="rounded-md border bg-transparent px-2 py-1.5 text-sm"
            aria-label={t('bulk.assignTo')}
          >
            <option value="">{t('bulk.unassign')}</option>
            {reps.map((r) => (
              <option key={r.id} value={r.id}>
                {r.full_name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={assignPending}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-[var(--color-muted)] disabled:opacity-50"
          >
            {t('bulk.assign')}
          </button>
        </form>
      ) : null}

      <form action={tagAction} className="flex items-center gap-2">
        {hiddenIds}
        <input
          name="tag"
          maxLength={40}
          placeholder={t('addTagPlaceholder')}
          className="w-40 rounded-md border bg-transparent px-2 py-1.5 text-sm"
        />
        <button
          type="submit"
          disabled={tagPending}
          className="rounded-md border px-3 py-1.5 text-sm hover:bg-[var(--color-muted)] disabled:opacity-50"
        >
          {t('bulk.addTag')}
        </button>
      </form>

      <button
        type="button"
        onClick={clear}
        className="ml-auto text-sm text-[var(--color-muted-foreground)] hover:underline"
      >
        {t('bulk.clear')}
      </button>
      {error ? <span className="w-full text-xs text-[var(--color-danger)]">{error}</span> : null}
    </div>
  );
}
