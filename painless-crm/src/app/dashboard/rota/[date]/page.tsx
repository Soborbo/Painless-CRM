import { requireRole } from '@/lib/auth/require-role';
import { type RotaAssignment, getRotaDay } from '@/lib/queries/rota';
import { addDaysYmd, isValidYmd } from '@/lib/rota/dates';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AssignForm } from './assign-form';
import { PrintButton } from './print-button';
import { RemoveAssignmentButton } from './remove-button';

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
          <PrintButton />
        </div>
      </header>

      {day.jobs.length === 0 ? (
        <p className="rounded-md border bg-[var(--color-muted)]/40 px-4 py-10 text-center text-sm text-[var(--color-muted-foreground)]">
          {t('noJobs')}
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          {day.jobs.map((job) => {
            const assignments = day.assignmentsByJob.get(job.id) ?? [];
            return (
              <section key={job.id} className="rounded-md border">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-[var(--color-muted)]/40 px-4 py-2">
                  <h2 className="font-medium">
                    <Link
                      href={`/dashboard/jobs/${job.id}`}
                      className="hover:underline print:no-underline"
                    >
                      {job.job_number}
                    </Link>{' '}
                    · {job.customer_name}
                  </h2>
                  <span className="text-xs text-[var(--color-muted-foreground)]">
                    {t('assignedCount', { count: assignments.length })}
                  </span>
                </div>

                <div className="flex flex-col gap-2 px-4 py-3">
                  {assignments.length === 0 ? (
                    <p className="text-sm text-[var(--color-muted-foreground)]">
                      {t('noneAssigned')}
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-1.5 text-sm">
                      {assignments.map((a) => (
                        <AssignmentLine key={a.id} a={a} date={date} roleLabel={roleLabel(a, t)} />
                      ))}
                    </ul>
                  )}
                  <AssignForm
                    jobId={job.id}
                    date={date}
                    workers={day.workers}
                    vehicles={day.vehicles}
                  />
                </div>
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}

function roleLabel(a: RotaAssignment, t: (k: string) => string): string {
  return a.role ? t(`roles.${a.role}`) : '';
}

function timeWindow(a: RotaAssignment): string {
  const fmt = (s: string | null) => (s ? s.slice(0, 5) : null);
  const start = fmt(a.scheduled_start);
  const end = fmt(a.scheduled_end);
  if (start && end) return `${start}–${end}`;
  if (start) return `${start}–`;
  return '';
}

function AssignmentLine({
  a,
  date,
  roleLabel: role,
}: {
  a: RotaAssignment;
  date: string;
  roleLabel: string;
}) {
  const meta = [role, a.vehicle_registration, timeWindow(a)].filter(Boolean).join(' · ');
  return (
    <li className="flex flex-wrap items-center justify-between gap-2">
      <span>
        <span className="font-medium">{a.worker_name}</span>
        {meta ? <span className="text-[var(--color-muted-foreground)]"> — {meta}</span> : null}
      </span>
      <RemoveAssignmentButton id={a.id} version={a.version} date={date} />
    </li>
  );
}
