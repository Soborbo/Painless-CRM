'use client';

import {
  type BriefActionState,
  INITIAL_BRIEF_STATE,
  addBriefItem,
  removeBriefItem,
  syncJobCalendar,
} from '@/lib/actions/job-brief';
import type { BriefItemRow, JobCalendarStatus } from '@/lib/queries/job-brief';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

interface Props {
  jobId: string;
  kit: BriefItemRow[];
  excluded: BriefItemRow[];
  status: JobCalendarStatus | null;
}

export function MoveBriefPanel({ jobId, kit, excluded, status }: Props) {
  const t = useTranslations('jobBrief');
  const [, addAction] = useActionState(addBriefItem, INITIAL_BRIEF_STATE);
  const [, removeAction] = useActionState(removeBriefItem, INITIAL_BRIEF_STATE);
  const [syncState, syncAction, syncing] = useActionState(syncJobCalendar, INITIAL_BRIEF_STATE);

  function list(kind: 'kit' | 'excluded', items: BriefItemRow[], title: string, empty: string) {
    return (
      <div className="flex flex-col gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide">{title}</h4>
        {items.length === 0 ? (
          <p className="text-xs text-[var(--color-muted-foreground)]">{empty}</p>
        ) : (
          <ul className="flex flex-col divide-y text-sm">
            {items.map((it) => (
              <li key={it.id} className="flex items-baseline justify-between gap-2 py-1">
                <span>
                  <span className="tabular-nums">{it.quantity}×</span> {it.item}
                  {it.notes ? (
                    <span className="text-[var(--color-muted-foreground)]"> — {it.notes}</span>
                  ) : null}
                </span>
                <form action={removeAction}>
                  <input type="hidden" name="id" value={it.id} />
                  <input type="hidden" name="job_id" value={jobId} />
                  <button
                    type="submit"
                    className="text-xs text-[var(--color-danger,#dc2626)] hover:underline"
                  >
                    {t('remove')}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <form action={addAction} className="flex flex-wrap gap-1.5">
          <input type="hidden" name="job_id" value={jobId} />
          <input type="hidden" name="kind" value={kind} />
          <input
            name="item"
            required
            placeholder={t('itemPlaceholder')}
            className="min-w-0 flex-1 rounded-md border px-2 py-1 text-sm"
          />
          <input
            name="quantity"
            type="number"
            min={1}
            defaultValue={1}
            aria-label={t('qtyPlaceholder')}
            className="w-14 rounded-md border px-2 py-1 text-sm"
          />
          <button
            type="submit"
            className="rounded-md border px-2 py-1 text-sm hover:bg-[var(--color-muted)]"
          >
            {t('add')}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="rounded-md border p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
          {t('title')}
        </h3>
        <SyncStatus status={status} label={t} />
      </div>

      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        {list('kit', kit, t('kitTitle'), t('emptyKit'))}
        {list('excluded', excluded, t('excludedTitle'), t('emptyExcluded'))}
      </div>

      <div className="mt-4 flex items-center gap-3 border-t pt-3">
        <form action={syncAction}>
          <input type="hidden" name="job_id" value={jobId} />
          <button
            type="submit"
            disabled={syncing}
            className="rounded-md border bg-[var(--color-primary)] px-3 py-1 text-sm font-medium text-[var(--color-primary-foreground)] disabled:opacity-50"
          >
            {syncing ? t('syncing') : t('syncNow')}
          </button>
        </form>
        {syncState.status === 'error' ? (
          <span className="text-xs text-[var(--color-danger,#dc2626)]">{syncState.message}</span>
        ) : null}
        {status?.htmlLink ? (
          <a
            href={status.htmlLink}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-[var(--color-muted-foreground)] hover:underline"
          >
            {t('viewEvent')} →
          </a>
        ) : null}
      </div>
    </div>
  );
}

function SyncStatus({
  status,
  label,
}: {
  status: JobCalendarStatus | null;
  label: ReturnType<typeof useTranslations>;
}) {
  if (!status) {
    return (
      <span className="text-xs text-[var(--color-muted-foreground)]">{label('notSynced')}</span>
    );
  }
  const tone =
    status.status === 'synced'
      ? 'var(--color-success,#16a34a)'
      : status.status === 'failed'
        ? 'var(--color-danger,#dc2626)'
        : 'var(--color-muted-foreground)';
  return (
    <span className="text-xs" style={{ color: tone }} title={status.lastError ?? undefined}>
      {label(`status_${status.status}`)}
    </span>
  );
}
