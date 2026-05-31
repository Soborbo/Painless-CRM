'use client';

import {
  type CallbackActionState,
  INITIAL_CALLBACK_ACTION_STATE,
  completeCallback,
} from '@/lib/actions/phone-calls';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

// §4 follow-up: clears a scheduled call-back from the open queue. Lives as its
// own client island so the queue page itself stays a server component.
export function CompleteCallbackButton({ phoneCallId }: { phoneCallId: string }) {
  const t = useTranslations('callbacks');
  const [state, formAction, pending] = useActionState<CallbackActionState, FormData>(
    completeCallback,
    INITIAL_CALLBACK_ACTION_STATE,
  );

  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="phone_call_id" value={phoneCallId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded border px-2 py-1 text-xs font-medium hover:bg-[var(--color-muted)] disabled:opacity-50"
      >
        {state.status === 'error' ? t('markDoneRetry') : t('markDone')}
      </button>
    </form>
  );
}
