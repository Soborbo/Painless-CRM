import { requireRole } from '@/lib/auth/require-role';
import { getRotaDay } from '@/lib/queries/rota';
import { addDaysYmd, isValidYmd } from '@/lib/rota/dates';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { RotaBoard } from './rota-board';

type Props = { params: Promise<{ date: string }> };

const FULL_DATE = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

export default async function RotaDayPage({ params }: Props) {
  await requireRole(['manager', 'admin', 'super_admin']);
  const { date } = await params;
  if (!isValidYmd(date)) notFound();

  const day = await getRotaDay(date);
  const t = await getTranslations('rota');
  const heading = FULL_DATE.format(new Date(`${date}T00:00:00.000Z`));

  const jobs = day.jobs.map((job) => ({
    ...job,
    assignments: day.assignmentsByJob.get(job.id) ?? [],
  }));

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-[var(--color-muted-foreground)] print:hidden">
            <Link href="/dashboard/rota" className="hover:underline">
              {t('title')}
            </Link>
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{heading}</h1>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <Link
            href={`/dashboard/rota/${addDaysYmd(date, -1)}`}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-[var(--color-muted)]"
          >
            ← {t('prevDay')}
          </Link>
          <Link
            href={`/dashboard/rota/${addDaysYmd(date, 1)}`}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-[var(--color-muted)]"
          >
            {t('nextDay')} →
          </Link>
          <Link
            href={`/dashboard/rota/${date}/print`}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-[var(--color-muted)]"
          >
            {t('print')}
          </Link>
        </div>
      </header>

      {jobs.length === 0 ? (
        <p className="rounded-md border bg-[var(--color-muted)]/40 px-4 py-10 text-center text-sm text-[var(--color-muted-foreground)]">
          {t('noJobs')}
        </p>
      ) : (
        <RotaBoard date={date} jobs={jobs} workers={day.workers} vehicles={day.vehicles} />
      )}
    </main>
  );
}
