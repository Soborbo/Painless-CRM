import { requireUser } from '@/lib/auth/require-role';
import { getWorkerForUser, getWorkerJobDetail, hasJobSheet } from '@/lib/queries/worker-app';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SheetForm } from './sheet-form';

type Props = { params: Promise<{ id: string }> };

export default async function JobSheetPage({ params }: Props) {
  const { id } = await params;
  const me = await requireUser();
  const worker = await getWorkerForUser(me.id);
  if (!worker) notFound();

  const today = new Date().toISOString().slice(0, 10);
  const job = await getWorkerJobDetail(id, worker.id, today);
  if (!job) notFound();

  const alreadySubmitted = await hasJobSheet(worker.id, id);
  const t = await getTranslations('workerApp');

  return (
    <main className="flex flex-col gap-5">
      <header>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          <Link href={`/jobs/${id}`} className="hover:underline">
            ← {job.job_number}
          </Link>
        </p>
        <h1 className="mt-1 text-xl font-semibold">{t('sheet.heading')}</h1>
      </header>

      {alreadySubmitted ? (
        <p className="rounded-md bg-[var(--color-success,#16a34a)]/15 px-3 py-2 text-sm text-[var(--color-success,#16a34a)]">
          {t('sheet.alreadySubmitted')}
        </p>
      ) : (
        <SheetForm jobId={id} jobNumber={job.job_number} />
      )}
    </main>
  );
}
