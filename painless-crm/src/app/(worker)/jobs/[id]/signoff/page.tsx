import { requireUser } from '@/lib/auth/require-role';
import { getDocumentTextByCompanyId } from '@/lib/queries/customisation';
import { getWorkerForUser, getWorkerJobDetail, hasSignoff } from '@/lib/queries/worker-app';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SignoffForm } from './signoff-form';

type Props = { params: Promise<{ id: string }> };

export default async function JobSignoffPage({ params }: Props) {
  const { id } = await params;
  const me = await requireUser();
  const worker = await getWorkerForUser(me.id);
  if (!worker) notFound();

  const today = new Date().toISOString().slice(0, 10);
  const job = await getWorkerJobDetail(id, worker.id, today);
  if (!job) notFound();

  const alreadySigned = await hasSignoff(id);
  const documentText = await getDocumentTextByCompanyId(me.company_id);
  const t = await getTranslations('workerApp');

  return (
    <main className="flex flex-col gap-5">
      <header>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          <Link href={`/jobs/${id}`} className="hover:underline">
            ← {job.job_number}
          </Link>
        </p>
        <h1 className="mt-1 text-xl font-semibold">{t('signoff.heading')}</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">{job.customer_name}</p>
      </header>

      {alreadySigned ? (
        <p className="rounded-md bg-[var(--color-success,#16a34a)]/15 px-3 py-2 text-sm text-[var(--color-success,#16a34a)]">
          {t('signoff.alreadySigned')}
        </p>
      ) : (
        <>
          {documentText.signoff_declaration ? (
            <p className="whitespace-pre-wrap rounded-md border p-3 text-sm text-[var(--color-muted-foreground)]">
              {documentText.signoff_declaration}
            </p>
          ) : null}
          <SignoffForm jobId={id} jobNumber={job.job_number} />
        </>
      )}
    </main>
  );
}
