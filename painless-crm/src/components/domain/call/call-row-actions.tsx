'use client';

import {
  type CallInboxState,
  INITIAL_CALL_INBOX_STATE,
  createJobFromCall,
  markCallReturned,
} from '@/lib/actions/calls';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

// Client island for the call-inbox row actions. The page itself stays a server
// component; this handles "mark called back" (with an optional note that the
// action writes to the linked job) and "create job from call" (ADR-041).
export function CallRowActions({
  callId,
  hasJob,
  returned,
}: {
  callId: string;
  hasJob: boolean;
  returned: boolean;
}) {
  const t = useTranslations('callsInbox');
  const [returnState, returnAction, returnPending] = useActionState<CallInboxState, FormData>(
    markCallReturned,
    INITIAL_CALL_INBOX_STATE,
  );
  const [, createAction, createPending] = useActionState<CallInboxState, FormData>(
    createJobFromCall,
    INITIAL_CALL_INBOX_STATE,
  );

  return (
    <div className="flex flex-col items-end gap-1.5">
      {!returned ? (
        <form action={returnAction} className="flex items-center gap-1.5">
          <input type="hidden" name="phone_call_id" value={callId} />
          <input
            type="text"
            name="note"
            placeholder={t('notePlaceholder')}
            className="w-40 rounded border px-2 py-1 text-xs"
          />
          <button
            type="submit"
            disabled={returnPending}
            className="rounded border px-2 py-1 text-xs font-medium hover:bg-[var(--color-muted)] disabled:opacity-50"
          >
            {returnState.status === 'error' ? t('retry') : t('markReturned')}
          </button>
        </form>
      ) : null}
      {!hasJob ? (
        <form action={createAction}>
          <input type="hidden" name="phone_call_id" value={callId} />
          <button
            type="submit"
            disabled={createPending}
            className="rounded border border-[var(--color-accent)] px-2 py-1 text-xs font-medium text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 disabled:opacity-50"
          >
            {t('createJob')}
          </button>
        </form>
      ) : null}
      {returnState.status === 'error' ? (
        <p className="text-[10px] text-red-600">{returnState.message}</p>
      ) : null}
    </div>
  );
}
