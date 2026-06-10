import { requireRole } from '@/lib/auth/require-role';
import { holidayCoversDate } from '@/lib/calendar/grid';
import { type LaneType, assembleBoard } from '@/lib/dispatch/board';
import { listStaffHolidays } from '@/lib/queries/appointments';
import { getDispatchBoardData } from '@/lib/queries/dispatch-board';
import { addDaysYmd, enumerateDates, isValidYmd, todayYmd } from '@/lib/rota/dates';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

const ROLES = ['manager', 'admin', 'super_admin'] as const;
const WEEKDAY = new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'UTC' });
const DAY_MONTH = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});

type Props = { searchParams: Promise<{ view?: string; start?: string; weeks?: string }> };

function parseView(v: string | undefined): LaneType {
  return v === 'vehicle' ? 'vehicle' : 'staff';
}
function parseWeeks(v: string | undefined): number {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 4 ? n : 1;
}

export default async function DispatchPage({ searchParams }: Props) {
  await requireRole(ROLES);
  const sp = await searchParams;
  const view = parseView(sp.view);
  const weeks = parseWeeks(sp.weeks);
  const start = isValidYmd(sp.start) ? sp.start : todayYmd(new Date());
  const dates = enumerateDates(start, weeks * 7);

  const data = await getDispatchBoardData(dates[0] as string, dates[dates.length - 1] as string);
  const lanes = view === 'staff' ? data.staffLanes : data.vehicleLanes;
  const board = assembleBoard(data.assignments, lanes, dates, view);
  const t = await getTranslations('dispatch');

  // Staff lanes overlay holidays: a worker off that day shows an "off" marker.
  const holidays =
    view === 'staff'
      ? await listStaffHolidays(dates[0] as string, dates[dates.length - 1] as string)
      : [];
  const offKey = new Set<string>();
  for (const h of holidays) {
    for (const d of dates) if (holidayCoversDate(h, d)) offKey.add(`${h.worker_id}|${d}`);
  }

  const href = (next: Partial<{ view: string; start: string; weeks: number }>) => {
    const p = new URLSearchParams({
      view: next.view ?? view,
      start: next.start ?? start,
      weeks: String(next.weeks ?? weeks),
    });
    return `/dashboard/dispatch?${p.toString()}`;
  };
  const cols = { gridTemplateColumns: `10rem repeat(${dates.length}, minmax(7rem, 1fr))` };

  return (
    <main className="mx-auto flex max-w-[110rem] flex-col gap-5 px-6 py-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{t('subtitle')}</p>
      </header>

      <div className="flex flex-wrap items-center gap-4 text-sm">
        <div className="flex gap-1">
          <Toggle active={view === 'staff'} href={href({ view: 'staff' })} label={t('staff')} />
          <Toggle
            active={view === 'vehicle'}
            href={href({ view: 'vehicle' })}
            label={t('vehicle')}
          />
        </div>
        <div className="flex gap-1">
          {[1, 2, 3, 4].map((w) => (
            <Toggle
              key={w}
              active={weeks === w}
              href={href({ weeks: w })}
              label={t('weeks', { count: w })}
            />
          ))}
        </div>
        <div className="ml-auto flex gap-1">
          <NavLink href={href({ start: addDaysYmd(start, -weeks * 7) })} label={t('prev')} />
          <NavLink href={href({ start: todayYmd(new Date()) })} label={t('today')} />
          <NavLink href={href({ start: addDaysYmd(start, weeks * 7) })} label={t('next')} />
        </div>
      </div>

      {board.lanes.length === 0 ? (
        <p className="rounded-md border p-6 text-sm text-[var(--color-muted-foreground)]">
          {t('noLanes')}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-fit">
            <div className="grid border-b text-xs font-medium" style={cols}>
              <div className="p-2" />
              {dates.map((d) => {
                const date = new Date(`${d}T00:00:00.000Z`);
                return (
                  <div key={d} className="border-l p-2 text-center">
                    <div className="text-[var(--color-muted-foreground)]">
                      {WEEKDAY.format(date)}
                    </div>
                    <div>{DAY_MONTH.format(date)}</div>
                  </div>
                );
              })}
            </div>

            {board.lanes.map((lane) => (
              <div key={lane.laneId} className="grid border-b" style={cols}>
                <div className="flex items-center p-2 text-sm font-medium">{lane.laneLabel}</div>
                {lane.cells.map((cell) => (
                  <div key={cell.date} className="min-h-14 border-l p-1.5">
                    <div className="flex flex-col gap-1">
                      {offKey.has(`${lane.laneId}|${cell.date}`) ? (
                        <span className="rounded bg-rose-100 px-1 py-0.5 text-[10px] font-medium text-rose-900">
                          {t('off')}
                        </span>
                      ) : null}
                      {cell.slots.map((slot) => (
                        <Link
                          key={`${slot.job_id}-${slot.role ?? ''}`}
                          href={`/dashboard/jobs/${slot.job_id}`}
                          className="block rounded-md border bg-[var(--color-muted)]/30 px-1.5 py-1 text-[11px] hover:bg-[var(--color-muted)]/60"
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-mono font-medium">{slot.job_number}</span>
                            {slot.scheduled_start ? (
                              <span className="text-[var(--color-muted-foreground)]">
                                {slot.scheduled_start.slice(0, 5)}
                              </span>
                            ) : null}
                          </div>
                          <div className="truncate text-[var(--color-muted-foreground)]">
                            {slot.customer_name}
                          </div>
                          <div className="mt-0.5 flex flex-wrap gap-1">
                            {slot.role ? <Chip tone="neutral">{slot.role}</Chip> : null}
                            {slot.awaitingPayment ? (
                              <Chip tone="amber">{t('badgeAwaitingPayment')}</Chip>
                            ) : null}
                            {slot.needsFollowUpCall ? (
                              <Chip tone="blue">{t('badgeFollowUp')}</Chip>
                            ) : null}
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}

function Toggle({ active, href, label }: { active: boolean; href: string; label: string }) {
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

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-md border px-3 py-1.5 text-xs hover:bg-[var(--color-muted)]"
    >
      {label}
    </Link>
  );
}

function Chip({
  tone,
  children,
}: { tone: 'neutral' | 'amber' | 'blue'; children: React.ReactNode }) {
  const cls = {
    neutral: 'bg-zinc-100 text-zinc-700',
    amber: 'bg-amber-100 text-amber-900',
    blue: 'bg-blue-100 text-blue-900',
  }[tone];
  return <span className={`rounded px-1 py-0.5 text-[10px] font-medium ${cls}`}>{children}</span>;
}
