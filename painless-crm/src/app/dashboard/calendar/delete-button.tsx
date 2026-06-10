'use client';

import {
  type CalendarActionState,
  INITIAL_CALENDAR_STATE,
  deleteAppointment,
  deleteStaffHoliday,
} from '@/lib/actions/appointments';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

// Phase 22 follow-up — remove an appointment or a staff-holiday entry from the
// agenda (week/day) views. Soft delete via the existing calendar actions.
export function CalendarDeleteButton({
  id,
  kind,
}: {
  id: string;
  kind: 'appointment' | 'holiday';
}) {
  const t = useTranslations('calendar');
  const [state, action, pending] = useActionState<CalendarActionState, FormData>(
    kind === 'appointment' ? deleteAppointment : deleteStaffHoliday,
    INITIAL_CALENDAR_STATE,
  );

  return (
    <form
      action={action}
      className="inline-flex items-center"
      onSubmit={(e) => {
        if (!confirm(t('confirmRemove'))) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        aria-label={t('remove')}
        title={t('remove')}
        className="rounded px-1 text-xs leading-none text-[var(--color-muted-foreground)] hover:bg-[var(--color-danger)]/10 hover:text-[var(--color-danger)] disabled:opacity-50"
      >
        ×
      </button>
      {state.status === 'error' ? (
        <span className="ml-1 text-[10px] text-[var(--color-danger)]">{state.message}</span>
      ) : null}
    </form>
  );
}
