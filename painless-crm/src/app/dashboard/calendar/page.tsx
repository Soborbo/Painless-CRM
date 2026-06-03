import { requireRole } from '@/lib/auth/require-role';
import { type CalendarView, viewDays } from '@/lib/calendar/grid';
import { listAppointments, listStaffHolidays } from '@/lib/queries/appointments';
import { listCustomerOptions } from '@/lib/queries/customers';
import { listWorkerOptions } from '@/lib/queries/workers';
import { APPOINTMENT_CATEGORIES } from '@/lib/schemas/appointment';
import { addDaysYmd, isValidYmd, todayYmd } from '@/lib/rota/dates';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { AddAppointmentForm } from './add-appointment-form';
import { AddHolidayForm } from './add-holiday-form';
import { AgendaView } from './agenda-view';
import { MonthView } from './month-view';

const ROLES = ['manager', 'admin', 'super_admin'] as const;

export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<{ view?: string; date?: string; category?: string }> };

function parseView(v: string | undefined): CalendarView {
  return v === 'week' || v === 'day' ? v : 'month';
}

function shift(view: CalendarView, anchor: string, dir: 1 | -1): string {
  if (view === 'day') return addDaysYmd(anchor, dir);
  if (view === 'week') return addDaysYmd(anchor, dir * 7);
  const [y, m] = anchor.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(y, m - 1 + dir, 1)).toISOString().slice(0, 10);
}

export default async function CalendarPage({ searchParams }: Props) {
  await requireRole(ROLES);
  const sp = await searchParams;
  const view = parseView(sp.view);
  const anchor = isValidYmd(sp.date) ? sp.date : todayYmd(new Date());
  const category = (APPOINTMENT_CATEGORIES as readonly string[]).includes(sp.category ?? '')
    ? (sp.category as string)
    : '';

  const days = viewDays(view, anchor);
  const fromYmd = days[0] as string;
  const toYmd = days[days.length - 1] as string;
  const fromIso = `${fromYmd}T00:00:00.000Z`;
  const toIso = `${addDaysYmd(toYmd, 1)}T00:00:00.000Z`;

  const [allAppts, holidays, workers, customers, t] = await Promise.all([
    listAppointments(fromIso, toIso),
    listStaffHolidays(fromYmd, toYmd),
    listWorkerOptions(),
    listCustomerOptions(),
    getTranslations('calendar'),
  ]);
  const appts = category ? allAppts.filter((a) => a.category === category) : allAppts;

  const href = (next: Partial<{ view: CalendarView; date: string; category: string }>) => {
    const p = new URLSearchParams({
      view: next.view ?? view,
      date: next.date ?? anchor,
      category: next.category ?? category,
    });
    return `/dashboard/calendar?${p.toString()}`;
  };

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-5 px-6 py-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{t('subtitle')}</p>
      </header>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <div className="flex gap-1">
          {(['month', 'week', 'day'] as const).map((v) => (
            <Pill key={v} active={view === v} href={href({ view: v })} label={t(v)} />
          ))}
        </div>
        <div className="flex gap-1">
          <Pill active={false} href={href({ date: shift(view, anchor, -1) })} label={t('prev')} />
          <Pill active={false} href={href({ date: todayYmd(new Date()) })} label={t('today')} />
          <Pill active={false} href={href({ date: shift(view, anchor, 1) })} label={t('next')} />
        </div>
        <form className="ml-auto flex items-center gap-2">
          <input type="hidden" name="view" value={view} />
          <input type="hidden" name="date" value={anchor} />
          <label className="text-xs text-[var(--color-muted-foreground)]">{t('category')}</label>
          <select
            name="category"
            defaultValue={category}
            className="rounded-md border px-2 py-1 text-xs"
          >
            <option value="">{t('allCategories')}</option>
            {APPOINTMENT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(`cat_${c}`)}
              </option>
            ))}
          </select>
          <button type="submit" className="rounded-md border px-2 py-1 text-xs hover:bg-[var(--color-muted)]">
            {t('apply')}
          </button>
        </form>
      </div>

      {view === 'month' ? (
        <MonthView anchor={anchor} appts={appts} holidays={holidays} />
      ) : (
        <AgendaView days={days} appts={appts} holidays={holidays} />
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <AddAppointmentForm defaultDate={anchor} workers={workers} customers={customers} />
        <AddHolidayForm defaultDate={anchor} workers={workers} />
      </div>
    </main>
  );
}

function Pill({ active, href, label }: { active: boolean; href: string; label: string }) {
  return (
    <Link
      href={href}
      className={
        active
          ? 'rounded-md bg-[var(--color-primary)] px-3 py-1.5 text-xs font-medium text-[var(--color-primary-foreground)]'
          : 'rounded-md border px-3 py-1.5 text-xs hover:bg-[var(--color-muted)]'
      }
    >
      {label}
    </Link>
  );
}
