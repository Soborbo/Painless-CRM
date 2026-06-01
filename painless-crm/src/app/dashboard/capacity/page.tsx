import { requireRole } from '@/lib/auth/require-role';
import type { CapacityBand } from '@/lib/capacity/band';
import { capacityWindow, chunkIntoWeeks } from '@/lib/capacity/calendar';
import { type DayCapacity, getCapacityCalendar } from '@/lib/queries/capacity';
import { getTranslations } from 'next-intl/server';

const CAPACITY_ROLES = ['manager', 'admin', 'super_admin'] as const;

export const dynamic = 'force-dynamic';

const BAND_CLASS: Record<CapacityBand, string> = {
  green: 'bg-emerald-100 text-emerald-900 border-emerald-200',
  yellow: 'bg-amber-100 text-amber-900 border-amber-200',
  red: 'bg-red-100 text-red-900 border-red-200',
  closed: 'bg-gray-200 text-gray-600 border-gray-300',
};

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default async function CapacityPage() {
  await requireRole(CAPACITY_ROLES);
  const window = capacityWindow(new Date());
  const [days, t] = await Promise.all([getCapacityCalendar(window), getTranslations('capacity')]);
  const byDate = new Map(days.map((d) => [d.date, d]));
  const weeks = chunkIntoWeeks(days.map((d) => d.date));

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{t('subtitle')}</p>
      </header>

      <Legend t={t} />

      <section className="overflow-x-auto">
        <div className="grid min-w-[640px] grid-cols-7 gap-2">
          {WEEKDAYS.map((d) => (
            <div
              key={d}
              className="px-1 text-center text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]"
            >
              {d}
            </div>
          ))}
          {weeks.flatMap((week) =>
            week.map((date) => {
              const day = byDate.get(date);
              return <DayCell key={date} date={date} day={day} t={t} />;
            }),
          )}
        </div>
      </section>
    </main>
  );
}

function DayCell({
  date,
  day,
  t,
}: {
  date: string;
  day: DayCapacity | undefined;
  t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  const band: CapacityBand = day?.band ?? 'green';
  const dayOfMonth = Number.parseInt(date.slice(8, 10), 10);
  return (
    <div className={`flex flex-col gap-1 rounded-md border p-2 text-xs ${BAND_CLASS[band]}`}>
      <div className="flex items-baseline justify-between">
        <span className="font-semibold tabular-nums">{dayOfMonth}</span>
        {day?.override ? <span title={t('overridden')}>★</span> : null}
      </div>
      <span className="tabular-nums">{t('util', { pct: day?.utilizationPct ?? 0 })}</span>
      <span className="tabular-nums text-[0.7rem] opacity-80">
        {t('jobs', { count: day?.jobCount ?? 0 })}
      </span>
    </div>
  );
}

function Legend({ t }: { t: Awaited<ReturnType<typeof getTranslations>> }) {
  const items: CapacityBand[] = ['green', 'yellow', 'red', 'closed'];
  return (
    <div className="flex flex-wrap gap-3 text-xs">
      {items.map((band) => (
        <span key={band} className="flex items-center gap-1.5">
          <span className={`inline-block h-3 w-3 rounded-sm border ${BAND_CLASS[band]}`} />
          {t(`bands.${band}` as never)}
        </span>
      ))}
    </div>
  );
}
