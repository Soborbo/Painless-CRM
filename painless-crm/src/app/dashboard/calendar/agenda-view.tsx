import {
  type CalendarAppointment,
  type CalendarHoliday,
  groupAppointmentsByDay,
  workersOnHoliday,
} from '@/lib/calendar/grid';
import { getTranslations } from 'next-intl/server';
import { AppointmentChip } from './appt-chip';
import { CalendarDeleteButton } from './delete-button';

const HEADING = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});

// Shared by the week (7 days) and day (1 day) views — a per-day agenda list.
export async function AgendaView({
  days,
  appts,
  holidays,
}: {
  days: string[];
  appts: CalendarAppointment[];
  holidays: CalendarHoliday[];
}) {
  const t = await getTranslations('calendar');
  const byDay = groupAppointmentsByDay(appts);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {days.map((day) => {
        const dayAppts = byDay.get(day) ?? [];
        const off = workersOnHoliday(holidays, day);
        return (
          <section
            key={day}
            className={`rounded-md border p-3 ${day === today ? 'ring-1 ring-[var(--color-primary)]' : ''}`}
          >
            <h3 className="text-sm font-medium">
              {HEADING.format(new Date(`${day}T00:00:00.000Z`))}
            </h3>
            <div className="mt-2 flex flex-col gap-1">
              {dayAppts.length === 0 ? (
                <p className="text-xs text-[var(--color-muted-foreground)]">{t('empty')}</p>
              ) : (
                dayAppts.map((a) => (
                  <div key={a.id} className="flex items-center gap-1">
                    <div className="min-w-0 flex-1">
                      <AppointmentChip appt={a} />
                    </div>
                    <CalendarDeleteButton id={a.id} kind="appointment" />
                  </div>
                ))
              )}
              {off.map((h) => (
                <div key={h.id} className="mt-1 flex items-center gap-1">
                  <span className="min-w-0 flex-1 truncate rounded bg-rose-100 px-1.5 py-0.5 text-[10px] text-rose-900">
                    {t('away', { names: h.worker_name })} · {t(`kind_${h.kind}` as never)}
                  </span>
                  <CalendarDeleteButton id={h.id} kind="holiday" />
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
