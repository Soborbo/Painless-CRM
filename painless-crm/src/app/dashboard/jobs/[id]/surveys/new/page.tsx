import { requireRole } from '@/lib/auth/require-role';
import Link from 'next/link';
import { SurveyForm } from '../survey-form';

const SURVEY_ROLES = ['surveyor', 'manager', 'admin', 'super_admin'] as const;

type Props = { params: Promise<{ id: string }> };

export default async function NewSurveyPage({ params }: Props) {
  await requireRole(SURVEY_ROLES);
  const { id } = await params;

  return (
    <main className="mx-auto max-w-2xl px-6 py-8">
      <p className="text-sm text-[var(--color-muted-foreground)]">
        <Link href={`/dashboard/jobs/${id}/surveys`} className="hover:underline">
          ← Surveys
        </Link>
      </p>
      <h1 className="mt-1 mb-6 text-xl font-semibold">New survey</h1>
      <SurveyForm jobId={id} />
    </main>
  );
}
