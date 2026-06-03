import { requireRole } from '@/lib/auth/require-role';
import { getCubicPresetsForCompany } from '@/lib/queries/customisation';
import { getSurvey } from '@/lib/queries/surveys';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SurveyForm } from '../survey-form';
import { CubicSheet } from './cubic-sheet';

const SURVEY_ROLES = ['surveyor', 'manager', 'admin', 'super_admin'] as const;

type Props = { params: Promise<{ id: string; surveyId: string }> };

export default async function SurveyDetailPage({ params }: Props) {
  const me = await requireRole(SURVEY_ROLES);
  const { id, surveyId } = await params;
  const result = await getSurvey(surveyId);
  if (!result || result.survey.job_id !== id) notFound();
  const presets = await getCubicPresetsForCompany(me.company_id);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
      <header>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          <Link href={`/dashboard/jobs/${id}/surveys`} className="hover:underline">
            ← Surveys
          </Link>
        </p>
        <h1 className="mt-1 text-xl font-semibold">Survey detail</h1>
      </header>

      <section className="rounded-md border p-4">
        <SurveyForm jobId={id} survey={result.survey} />
      </section>

      <CubicSheet
        surveyId={surveyId}
        items={result.items}
        summary={result.summary}
        presets={presets}
      />
    </main>
  );
}
