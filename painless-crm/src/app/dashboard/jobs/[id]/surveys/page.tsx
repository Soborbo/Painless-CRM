import { requireRole } from '@/lib/auth/require-role';
import { getSurveysForJob } from '@/lib/queries/surveys';
import { formatDate, formatDateTime } from '@/lib/utils/format';
import Link from 'next/link';

const SURVEY_ROLES = ['surveyor', 'manager', 'admin', 'super_admin'] as const;

type Props = { params: Promise<{ id: string }> };

export default async function JobSurveysPage({ params }: Props) {
  await requireRole(SURVEY_ROLES);
  const { id } = await params;
  const surveys = await getSurveysForJob(id);

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <p className="text-sm text-[var(--color-muted-foreground)]">
        <Link href={`/dashboard/jobs/${id}`} className="hover:underline">
          ← Back to job
        </Link>
      </p>
      <div className="mt-1 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Surveys</h1>
        <Link
          href={`/dashboard/jobs/${id}/surveys/new`}
          className="rounded-md border bg-[var(--color-primary)] px-3 py-1.5 text-sm font-medium text-[var(--color-primary-foreground)]"
        >
          New survey
        </Link>
      </div>

      <div className="mt-6 flex flex-col gap-3">
        {surveys.length === 0 ? (
          <p className="text-sm text-[var(--color-muted-foreground)]">
            No surveys for this job yet.
          </p>
        ) : (
          surveys.map((s) => (
            <Link
              key={s.id}
              href={`/dashboard/jobs/${id}/surveys/${s.id}`}
              className="rounded-md border p-3 text-sm hover:bg-[var(--color-muted)]"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{s.survey_type ?? 'survey'}</span>
                <span className="text-xs text-[var(--color-muted-foreground)]">
                  {s.completed_at ? `Completed ${formatDate(s.completed_at)}` : 'In progress'}
                </span>
              </div>
              <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                {s.cubic_ft_estimate != null ? `${s.cubic_ft_estimate} ft³` : 'No estimate'}
                {s.surveyor_name ? ` · ${s.surveyor_name}` : ''}
                {s.scheduled_at ? ` · scheduled ${formatDateTime(s.scheduled_at)}` : ''}
              </p>
            </Link>
          ))
        )}
      </div>
    </main>
  );
}
