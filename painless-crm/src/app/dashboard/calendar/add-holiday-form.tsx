'use client';

import {
  INITIAL_CALENDAR_STATE,
  type CalendarActionState,
  createStaffHoliday,
} from '@/lib/actions/appointments';
import { HOLIDAY_KINDS } from '@/lib/schemas/appointment';
import { useTranslations } from 'next-intl';
import { useActionState, useRef } from 'react';

type Option = { id: string; label: string };

export function AddHolidayForm({
  defaultDate,
  workers,
}: {
  defaultDate: string;
  workers: Option[];
}) {
  const t = useTranslations('calendar');
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<CalendarActionState, FormData>(
    async (prev, fd) => {
      const next = await createStaffHoliday(prev, fd);
      if (next.status === 'ok') formRef.current?.reset();
      return next;
    },
    INITIAL_CALENDAR_STATE,
  );

  const field = 'rounded-md border px-2 py-1.5 text-sm';

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-2 rounded-md border p-4">
      <h2 className="text-sm font-semibold">{t('addHoliday')}</h2>
      <select name="worker_id" required defaultValue="" className={field} aria-label={t('worker')}>
        <option value="" disabled>
          {t('pickWorker')}
        </option>
        {workers.map((w) => (
          <option key={w.id} value={w.id}>
            {w.label}
          </option>
        ))}
      </select>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-[11px] text-[var(--color-muted-foreground)]">
          {t('starts')}
          <input name="start_date" type="date" defaultValue={defaultDate} required className={field} />
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-[var(--color-muted-foreground)]">
          {t('ends')}
          <input name="end_date" type="date" defaultValue={defaultDate} required className={field} />
        </label>
      </div>
      <select name="kind" defaultValue="holiday" className={field} aria-label={t('kind')}>
        {HOLIDAY_KINDS.map((k) => (
          <option key={k} value={k}>
            {t(`kind_${k}`)}
          </option>
        ))}
      </select>
      <input name="notes" maxLength={2000} placeholder={t('notes')} className={field} />

      {state.status === 'error' ? <p className="text-xs text-red-600">{state.message}</p> : null}
      {state.status === 'ok' ? <p className="text-xs text-emerald-600">{t('saved')}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md border bg-[var(--color-primary)] px-3 py-1.5 text-xs font-medium text-[var(--color-primary-foreground)] disabled:opacity-50"
      >
        {pending ? t('saving') : t('add')}
      </button>
    </form>
  );
}
