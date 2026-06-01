import { requireUser } from '@/lib/auth/require-role';
import { getTodaysAssignments, getWorkerForUser } from '@/lib/queries/worker-app';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

const TIME = (s: string | null) => (s ? s.slice(0, 5) : null);

export default async function WorkerHomePage() {
  const me = await requireUser();
  const worker = await getWorkerForUser(me.id);
  const t = await getTranslations('workerApp');

  if (!worker) {
    return (
      <main className="flex flex-col gap-3">
        <h1 className="text-xl font-semibold">{t('todaysJobs')}</h1>
        <p className="rounded-md border bg-[var(--color-muted)]/40 px-4 py-6 text-sm text-[var(--color-muted-foreground)]">
          {t('noWorkerProfile')}
        </p>
      </main>
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const jobs = await getTodaysAssignments(worker.id, today);

  return (
    <main className="flex flex-col gap-4">
      <header>
        <h1 className="text-xl font-semibold">{t('todaysJobs')}</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">{worker.full_name}</p>
      </header>

      {jobs.length === 0 ? (
        <p className="rounded-md border bg-[var(--color-muted)]/40 px-4 py-6 text-center text-sm text-[var(--color-muted-foreground)]">
          {t('noJobsToday')}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {jobs.map((job) => {
            const start = TIME(job.scheduled_start);
            const end = TIME(job.scheduled_end);
            return (
              <li key={job.job_id}>
                <Link
                  href={`/jobs/${job.job_id}`}
                  className="flex flex-col gap-1 rounded-lg border p-4 transition-colors active:bg-[var(--color-muted)]/40"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{job.job_number}</span>
                    {job.clocked_in ? (
                      <span className="rounded-full bg-[var(--color-success,#16a34a)]/15 px-2 py-0.5 text-xs font-medium text-[var(--color-success,#16a34a)]">
                        {t('clockedIn')}
                      </span>
                    ) : null}
                  </div>
                  <span className="text-sm">{job.customer_name}</span>
                  <span className="text-xs text-[var(--color-muted-foreground)]">
                    {[
                      job.role ? t(`roles.${job.role}`) : null,
                      start && end ? `${start}–${end}` : start,
                    ]
                      .filter(Boolean)
                      .join(' · ') || t('noTimeSet')}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
