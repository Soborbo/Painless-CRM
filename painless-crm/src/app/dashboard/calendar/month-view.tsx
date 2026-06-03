import {
  type CalendarAppointment,
  type CalendarHoliday,
  chunkWeeks,
  groupAppointmentsByDay,
  sameMonth,
  viewDays,
  workersOnHoliday,
} from '@/lib/calendar/grid';
import { getTranslations } from 'next-intl/server';
import { AppointmentChip } from './appt-chip';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_NUM = new Intl.DateTimeFormat('en-GB', { day: 'numeric', timeZone: 'UTC' });

export async function MonthView({
  anchor,
  appts,
  holidays,
}: {
  anchor: string;
  appts: CalendarAppointment[];
  holidays: CalendarHoliday[];
}) {
  const t = await getTranslations('calendar');
  const weeks = chunkWeeks(viewDays('month', anchor));
  const byDay = groupAppointmentsByDay(appts);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="overflow-hidden rounded-md border">
      <div className="grid grid-cols-7 border-b bg-[var(--color-muted)]/40 text-[11px] font-medium">
        {WEEKDAYS.map((d) => (
          <div key={d} className="p-2 text-center">
            {d}
          </div>
        ))}
      </div>
      {weeks.map((week) => (
        <div key={week[0]} className="grid grid-cols-7">
          {week.map((day) => {
            const dayAppts = byDay.get(day) ?? [];
            const off = workersOnHoliday(holidays, day);
            const inMonth = sameMonth(day, anchor);
            return (
              <div
                key={day}
                className={`min-h-24 border-b border-l p-1 ${inMonth ? '' : 'bg-[var(--color-muted)]/20'}`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={
                      day === today
                        ? 'rounded bg-[var(--color-primary)] px-1.5 text-[11px] font-semibold text-[var(--color-primary-foreground)]'
                        : 'px-1 text-[11px] text-[var(--color-muted-foreground)]'
                    }
                  >
                    {DAY_NUM.format(new Date(`${day}T00:00:00.000Z`))}
                  </span>
                </div>
                <div className="mt-1 flex flex-col gap-0.5">
                  {dayAppts.slice(0, 4).map((a) => (
                    <AppointmentChip key={a.id} appt={a} />
                  ))}
                  {dayAppts.length > 4 ? (
                    <span className="px-1 text-[10px] text-[var(--color-muted-foreground)]">
                      {t('more', { count: dayAppts.length - 4 })}
                    </span>
                  ) : null}
                  {off.length > 0 ? (
                    <span className="truncate rounded bg-rose-100 px-1.5 py-0.5 text-[10px] text-rose-900">
                      {t('away', { names: off.map((h) => h.worker_name).join(', ') })}
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
