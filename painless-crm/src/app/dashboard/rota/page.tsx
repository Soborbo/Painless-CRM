import { requireRole } from '@/lib/auth/require-role';
import { getRotaJobCounts } from '@/lib/queries/rota';
import { enumerateDates, todayYmd } from '@/lib/rota/dates';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

const WINDOW_DAYS = 14;
const WEEKDAY = new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'UTC' });
const DAY_MONTH = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});

export default async function RotaIndexPage() {
  await requireRole(['manager', 'admin', 'super_admin']);

  const start = todayYmd(new Date());
  const days = enumerateDates(start, WINDOW_DAYS);
  const counts = await getRotaJobCounts(days[0] as string, days[days.length - 1] as string);
  const t = await getTranslations('rota');

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{t('subtitle')}</p>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {days.map((day) => {
          const count = counts.get(day) ?? 0;
          const date = new Date(`${day}T00:00:00.000Z`);
          return (
            <Link
              key={day}
              href={`/dashboard/rota/${day}`}
              className="flex flex-col gap-1 rounded-md border p-3 transition-colors hover:bg-[var(--color-muted)]/40"
            >
              <span className="text-xs text-[var(--color-muted-foreground)]">
                {WEEKDAY.format(date)}
              </span>
              <span className="font-medium">{DAY_MONTH.format(date)}</span>
              <span className="text-sm text-[var(--color-muted-foreground)]">
                {t('jobCount', { count })}
              </span>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
