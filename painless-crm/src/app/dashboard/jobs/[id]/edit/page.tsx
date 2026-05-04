import { requireRole } from '@/lib/auth/require-role';
import { getJobById, listSalesReps, listSurveyors } from '@/lib/queries/jobs';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { JobEditForm } from './edit-form';

type Props = { params: Promise<{ id: string }> };

export default async function EditJobPage({ params }: Props) {
  const { id } = await params;
  await requireRole(['sales', 'manager', 'admin', 'super_admin']);
  const [job, reps, surveyors, t] = await Promise.all([
    getJobById(id),
    listSalesReps(),
    listSurveyors(),
    getTranslations('jobs'),
  ]);
  if (!job) notFound();

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t('edit')}</h1>
        <p className="mt-1 font-mono text-sm text-[var(--color-muted-foreground)]">
          {job.job_number}
        </p>
      </header>
      <JobEditForm
        id={job.id}
        version={job.version}
        defaults={{
          acquisition_source: job.acquisition_source ?? 'website',
          assigned_to_id: job.assigned_to_id ?? '',
          surveyor_id: job.surveyor?.id ?? '',
          move_date: job.move_date ? job.move_date.slice(0, 10) : '',
          notes: job.notes ?? '',
        }}
        reps={reps.map((r) => ({ id: r.id, full_name: r.full_name }))}
        surveyors={surveyors.map((r) => ({ id: r.id, full_name: r.full_name }))}
      />
    </main>
  );
}
