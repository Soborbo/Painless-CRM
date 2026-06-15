'use client';

import { duplicateJob } from '@/lib/actions/job-duplicate';
import { type JobActionState, softDeleteJob } from '@/lib/actions/jobs';
import type { JobStage } from '@/lib/jobs/state-machine';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useLinkStatus } from 'next/link';
import { useActionState } from 'react';
import { QuickStageMenu } from './quick-stage-menu';

const INITIAL: JobActionState = { status: 'idle' };

const PILL =
  'inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] motion-safe:active:scale-95 disabled:opacity-50';

function Spinner() {
  return (
    <span
      aria-hidden
      className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"
    />
  );
}

/** Renders inside a <Link>: shows a spinner while the navigation is pending. */
function LinkPending() {
  const { pending } = useLinkStatus();
  return pending ? <Spinner /> : null;
}

export function JobCardActions({
  id,
  version,
  stage,
  isAdmin,
}: {
  id: string;
  version: number;
  stage: JobStage;
  isAdmin: boolean;
}) {
  const t = useTranslations('jobs');
  const [dupState, dupAction, dupPending] = useActionState(duplicateJob, INITIAL);
  const [delState, delAction, delPending] = useActionState(softDeleteJob, INITIAL);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-1.5">
        <Link
          href={`/dashboard/jobs/${id}`}
          className={`${PILL} bg-[var(--color-primary)] text-[var(--color-primary-foreground)] hover:opacity-90`}
        >
          {t('view')}
          <LinkPending />
        </Link>
        <Link
          href={`/dashboard/jobs/${id}/edit`}
          className={`${PILL} border bg-transparent hover:bg-[var(--color-muted)]`}
        >
          {t('edit')}
          <LinkPending />
        </Link>
        <QuickStageMenu id={id} version={version} stage={stage} />
        <form action={dupAction} className="contents">
          <input type="hidden" name="id" value={id} />
          <button
            type="submit"
            disabled={dupPending}
            aria-busy={dupPending}
            title={t('duplicateHint')}
            className={`${PILL} border bg-transparent hover:bg-[var(--color-muted)]`}
          >
            {t('duplicate')}
            {dupPending ? <Spinner /> : null}
          </button>
        </form>
        {isAdmin ? (
          <form
            action={delAction}
            className="contents"
            onSubmit={(e) => {
              if (!confirm(t('confirmDelete'))) e.preventDefault();
            }}
          >
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="version" value={version} />
            <button
              type="submit"
              disabled={delPending}
              aria-busy={delPending}
              className={`${PILL} border border-transparent text-[var(--color-danger)] hover:border-[var(--color-danger)]/40 hover:bg-[var(--color-danger)]/10`}
            >
              {t('delete')}
              {delPending ? <Spinner /> : null}
            </button>
          </form>
        ) : null}
      </div>
      {dupState.status === 'error' ? (
        <p className="text-[11px] text-[var(--color-danger)]">{dupState.message}</p>
      ) : null}
      {delState.status === 'error' ? (
        <p className="text-[11px] text-[var(--color-danger)]">{delState.message}</p>
      ) : null}
    </div>
  );
}
