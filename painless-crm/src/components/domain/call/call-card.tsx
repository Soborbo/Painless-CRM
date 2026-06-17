'use client';

import {
  type CallInboxState,
  INITIAL_CALL_INBOX_STATE,
  createJobFromCall,
  markCallReturned,
} from '@/lib/actions/calls';
import { formatDateTime } from '@/lib/utils/format';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useActionState, useEffect, useState } from 'react';

export interface CallCardProps {
  callId: string;
  caller: string | null;
  occurredAt: string;
  durationSeconds: number | null;
  repeatCount: number;
  customerName: string | null;
  customerId: string | null;
  jobId: string | null;
  jobNumber: string | null;
  returnedAt: string | null;
  returnedByName: string | null;
}

function formatDuration(s: number | null): string {
  if (s == null) return '—';
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return ss === 0 ? `${m}m` : `${m}m ${ss}s`;
}

// A whole-call clickable card (ADR-041). The row IS the trigger — clicking it
// anywhere opens the detail dialog with the full call data and a proper
// multi-line "what happened" note. Hover lifts the card slightly. Self-contained
// modal: closes on backdrop, ✕, Escape, or a successful action.
export function CallCard(props: CallCardProps) {
  const t = useTranslations('callsInbox');
  const [open, setOpen] = useState(false);
  const returned = Boolean(props.returnedAt);
  const hasJob = Boolean(props.jobId);

  const [returnState, returnAction, returnPending] = useActionState<CallInboxState, FormData>(
    markCallReturned,
    INITIAL_CALL_INBOX_STATE,
  );
  const [, createAction, createPending] = useActionState<CallInboxState, FormData>(
    createJobFromCall,
    INITIAL_CALL_INBOX_STATE,
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (returnState.status === 'ok') setOpen(false);
  }, [returnState.status]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`group block w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-4 py-3.5 text-left transition-all duration-150 hover:-translate-y-0.5 hover:border-[var(--color-accent)]/50 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] ${
          returned ? 'opacity-65' : ''
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="font-mono text-base font-medium">
              {props.caller ?? t('unknownCaller')}
            </span>
            {props.repeatCount > 1 ? (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                {t('repeat', { count: props.repeatCount })}
              </span>
            ) : null}
            {returned ? (
              <span className="rounded-full bg-[var(--color-muted)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-muted-foreground)]">
                {t('markReturned')}
              </span>
            ) : null}
          </div>
          <time className="shrink-0 text-xs text-[var(--color-muted-foreground)] tabular-nums">
            {formatDateTime(props.occurredAt)}
          </time>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[var(--color-muted-foreground)]">
          <span className={props.customerName ? '' : 'italic'}>
            {props.customerName ?? t('noMatch')}
          </span>
          {props.jobNumber ? (
            <>
              <span aria-hidden>·</span>
              <span className="font-mono">
                {t('columns.job')} {props.jobNumber}
              </span>
            </>
          ) : null}
          <span aria-hidden>·</span>
          <span className="tabular-nums">{formatDuration(props.durationSeconds)}</span>
        </div>
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label={t('close')}
            onClick={() => setOpen(false)}
            className="absolute inset-0 cursor-default bg-black/40"
          />
          <div className="relative z-10 w-full max-w-lg rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-mono text-lg font-semibold tracking-tight">
                  {props.caller ?? t('unknownCaller')}
                </h2>
                {props.repeatCount > 1 ? (
                  <span className="mt-1 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                    {t('repeat', { count: props.repeatCount })}
                  </span>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t('close')}
                className="rounded p-1 text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)]"
              >
                ✕
              </button>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div>
                <dt className="text-xs text-[var(--color-muted-foreground)]">{t('columns.when')}</dt>
                <dd className="tabular-nums">{formatDateTime(props.occurredAt)}</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--color-muted-foreground)]">{t('duration')}</dt>
                <dd className="tabular-nums">{formatDuration(props.durationSeconds)}</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--color-muted-foreground)]">{t('columns.customer')}</dt>
                <dd>
                  {props.customerId && props.customerName ? (
                    <Link
                      href={`/dashboard/customers/${props.customerId}`}
                      className="text-[var(--color-accent)] hover:underline"
                    >
                      {props.customerName}
                    </Link>
                  ) : (
                    <span className="text-[var(--color-muted-foreground)]">{t('noMatch')}</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--color-muted-foreground)]">{t('columns.job')}</dt>
                <dd>
                  {props.jobId ? (
                    <Link
                      href={`/dashboard/jobs/${props.jobId}`}
                      className="font-mono text-[var(--color-accent)] hover:underline"
                    >
                      {props.jobNumber ?? t('openJob')}
                    </Link>
                  ) : (
                    '—'
                  )}
                </dd>
              </div>
            </dl>

            {returned ? (
              <p className="mt-5 rounded-md bg-[var(--color-muted)] px-3 py-2 text-sm">
                {t('returnedBy', { name: props.returnedByName ?? '—' })} · {formatDateTime(props.returnedAt)}
              </p>
            ) : (
              <form action={returnAction} className="mt-5 flex flex-col gap-2">
                <input type="hidden" name="phone_call_id" value={props.callId} />
                <label htmlFor={`note-${props.callId}`} className="text-sm font-medium">
                  {t('whatHappened')}
                </label>
                <textarea
                  id={`note-${props.callId}`}
                  name="note"
                  rows={5}
                  placeholder={t('notePlaceholder')}
                  className="w-full resize-y rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                />
                <button
                  type="submit"
                  disabled={returnPending}
                  className="self-start rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-[var(--color-accent-foreground)] hover:opacity-90 disabled:opacity-50"
                >
                  {returnState.status === 'error' ? t('retry') : t('markReturned')}
                </button>
                {returnState.status === 'error' ? (
                  <p className="text-xs text-[var(--color-danger)]">{returnState.message}</p>
                ) : null}
              </form>
            )}

            {!hasJob ? (
              <form action={createAction} className="mt-4 border-t border-[var(--color-border)] pt-4">
                <input type="hidden" name="phone_call_id" value={props.callId} />
                <button
                  type="submit"
                  disabled={createPending}
                  className="rounded-md border border-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 disabled:opacity-50"
                >
                  {t('createJob')}
                </button>
              </form>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
