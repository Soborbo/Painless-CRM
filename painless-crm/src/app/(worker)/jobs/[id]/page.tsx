import { requireUser } from '@/lib/auth/require-role';
import {
  getAssignedVehicle,
  getRecordedTimeEntries,
  getWorkerForUser,
  getWorkerJobDetail,
} from '@/lib/queries/worker-app';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ClockInButton } from './clock-in-button';
import { TimeEntrySteps } from './time-entry-steps';

type Props = { params: Promise<{ id: string }> };

export default async function WorkerJobPage({ params }: Props) {
  const { id } = await params;
  const me = await requireUser();
  const worker = await getWorkerForUser(me.id);
  if (!worker) notFound();

  const today = new Date().toISOString().slice(0, 10);
  const job = await getWorkerJobDetail(id, worker.id, today);
  if (!job) notFound();

  const recorded = job.clocked_in ? await getRecordedTimeEntries(worker.id, id, today) : [];
  const assignedVehicle = await getAssignedVehicle(worker.id, id);
  const t = await getTranslations('workerApp');
  const mapsQuery = job.from_address
    ? encodeURIComponent(
        `${job.from_address.line1}, ${job.from_address.city} ${job.from_address.postcode}`,
      )
    : null;

  return (
    <main className="flex flex-col gap-5">
      <header>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          <Link href="/home" className="hover:underline">
            ← {t('todaysJobs')}
          </Link>
        </p>
        <h1 className="mt-1 text-xl font-semibold">{job.job_number}</h1>
        <p className="text-sm">{job.customer_name}</p>
      </header>

      {job.customer_phone ? (
        <a
          href={`tel:${job.customer_phone}`}
          className="rounded-lg border px-4 py-3 text-center text-sm font-medium active:bg-[var(--color-muted)]/40"
        >
          {t('callCustomer')} · {job.customer_phone}
        </a>
      ) : null}

      {job.from_address ? (
        <section className="rounded-lg border p-4">
          <p className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
            {t('fromAddress')}
          </p>
          <p className="mt-1 text-sm">
            {job.from_address.line1}, {job.from_address.city} {job.from_address.postcode}
          </p>
          {mapsQuery ? (
            <a
              href={`https://maps.apple.com/?q=${mapsQuery}`}
              className="mt-2 inline-block text-sm underline"
            >
              {t('openInMaps')}
            </a>
          ) : null}
        </section>
      ) : null}

      <section className="rounded-lg border p-4">
        <h2 className="mb-2 font-medium">{t('clockInHeading')}</h2>
        {job.clocked_in ? (
          <p className="rounded-md bg-[var(--color-success,#16a34a)]/15 px-3 py-2 text-sm text-[var(--color-success,#16a34a)]">
            {t('alreadyClockedIn')}
          </p>
        ) : (
          <ClockInButton jobId={job.job_id} jobNumber={job.job_number} />
        )}
      </section>

      {job.clocked_in ? (
        <section className="rounded-lg border p-4">
          <h2 className="mb-3 font-medium">{t('progressHeading')}</h2>
          <TimeEntrySteps jobId={job.job_id} jobNumber={job.job_number} recorded={recorded} />
        </section>
      ) : null}

      {assignedVehicle ? (
        <Link
          href={`/jobs/${job.job_id}/vehicle-check`}
          className="rounded-lg border px-4 py-3 text-center text-sm font-medium active:bg-[var(--color-muted)]/40"
        >
          {t('check.openLink')} · {assignedVehicle.registration}
        </Link>
      ) : null}

      {job.clocked_in ? (
        <Link
          href={`/jobs/${job.job_id}/sheet`}
          className="rounded-lg border px-4 py-3 text-center text-sm font-medium active:bg-[var(--color-muted)]/40"
        >
          {t('sheet.openLink')}
        </Link>
      ) : null}
    </main>
  );
}
