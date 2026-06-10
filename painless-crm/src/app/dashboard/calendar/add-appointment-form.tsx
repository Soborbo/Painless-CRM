'use client';

import {
  type CalendarActionState,
  INITIAL_CALENDAR_STATE,
  createAppointment,
} from '@/lib/actions/appointments';
import { APPOINTMENT_CATEGORIES } from '@/lib/schemas/appointment';
import { useTranslations } from 'next-intl';
import { useActionState, useRef } from 'react';

type Option = { id: string; label: string };

export function AddAppointmentForm({
  defaultDate,
  workers,
  customers,
}: {
  defaultDate: string;
  workers: Option[];
  customers: Option[];
}) {
  const t = useTranslations('calendar');
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<CalendarActionState, FormData>(
    async (prev, fd) => {
      const next = await createAppointment(prev, fd);
      if (next.status === 'ok') formRef.current?.reset();
      return next;
    },
    INITIAL_CALENDAR_STATE,
  );

  const field = 'rounded-md border px-2 py-1.5 text-sm';

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-2 rounded-md border p-4">
      <h2 className="text-sm font-semibold">{t('addAppointment')}</h2>
      <input name="title" required maxLength={200} placeholder={t('apptTitle')} className={field} />
      <div className="grid grid-cols-2 gap-2">
        <select name="category" defaultValue="survey" className={field} aria-label={t('category')}>
          {APPOINTMENT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {t(`cat_${c}`)}
            </option>
          ))}
        </select>
        <select name="assigned_to_id" defaultValue="" className={field} aria-label={t('assignee')}>
          <option value="">{t('unassigned')}</option>
          {workers.map((w) => (
            <option key={w.id} value={w.id}>
              {w.label}
            </option>
          ))}
        </select>
        <label className="flex flex-col gap-1 text-[11px] text-[var(--color-muted-foreground)]">
          {t('starts')}
          <input
            name="starts_at"
            type="datetime-local"
            defaultValue={`${defaultDate}T09:00`}
            required
            className={field}
          />
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-[var(--color-muted-foreground)]">
          {t('ends')}
          <input
            name="ends_at"
            type="datetime-local"
            defaultValue={`${defaultDate}T10:00`}
            required
            className={field}
          />
        </label>
      </div>
      <select name="customer_id" defaultValue="" className={field} aria-label={t('customer')}>
        <option value="">{t('noCustomer')}</option>
        {customers.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
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
