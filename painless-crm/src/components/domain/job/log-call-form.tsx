'use client';

import {
  INITIAL_LOG_PHONE_CALL_STATE,
  type LogPhoneCallState,
  logPhoneCall,
} from '@/lib/actions/phone-calls';
import { useTranslations } from 'next-intl';
import { useActionState, useRef } from 'react';

interface Props {
  jobId: string;
  defaultOccurredAt: string;
}

export function LogCallForm({ jobId, defaultOccurredAt }: Props) {
  const t = useTranslations('phoneCalls');
  const tc = useTranslations('common');
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<LogPhoneCallState, FormData>(
    async (prev, fd) => {
      const next = await logPhoneCall(prev, fd);
      if (next.status === 'ok') formRef.current?.reset();
      return next;
    },
    INITIAL_LOG_PHONE_CALL_STATE,
  );

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3 rounded-md border p-4">
      <input type="hidden" name="job_id" value={jobId} />
      <h3 className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
        {t('formTitle')}
      </h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          {t('direction')}
          <select name="direction" required className="rounded-md border px-3 py-2">
            <option value="inbound">{t('directions.inbound')}</option>
            <option value="outbound">{t('directions.outbound')}</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t('duration')}
          <input
            type="number"
            name="duration_seconds"
            min={0}
            max={14400}
            defaultValue={120}
            required
            className="rounded-md border px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          {t('occurredAt')}
          <input
            type="datetime-local"
            name="occurred_at"
            required
            defaultValue={defaultOccurredAt}
            className="rounded-md border px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t('callerNumber')}
          <input
            type="tel"
            name="caller_number"
            maxLength={40}
            className="rounded-md border px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t('calledNumber')}
          <input
            type="tel"
            name="called_number"
            maxLength={40}
            className="rounded-md border px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          {t('notes')}
          <textarea
            name="notes"
            maxLength={2000}
            rows={2}
            className="rounded-md border px-3 py-2"
          />
        </label>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md border bg-[var(--color-primary)] px-3 py-1.5 text-sm font-medium text-[var(--color-primary-foreground)] disabled:opacity-50"
        >
          {pending ? tc('loading') : t('submit')}
        </button>
        {state.status === 'ok' ? (
          <span className="text-xs text-green-700">{t('logged')}</span>
        ) : null}
        {state.status === 'error' ? (
          <span className="text-xs text-red-600">{state.message}</span>
        ) : null}
      </div>
    </form>
  );
}
