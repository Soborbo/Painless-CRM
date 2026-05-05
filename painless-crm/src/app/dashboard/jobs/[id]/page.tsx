import { CallsPanel } from '@/components/domain/job/calls-panel';
import { LogCallForm } from '@/components/domain/job/log-call-form';
import { NotesPanel } from '@/components/domain/job/notes-panel';
import { QuotesPanel } from '@/components/domain/job/quotes-panel';
import { StageBadge } from '@/components/domain/job/stage-badge';
import { requireUser } from '@/lib/auth/require-role';
import {
  getJobById,
  getJobStatusHistory,
  getJobTags,
  listSalesReps,
  listSurveyors,
} from '@/lib/queries/jobs';
import { listNotesForJob } from '@/lib/queries/notes';
import { listPhoneCallsForJob } from '@/lib/queries/phone-calls';
import { getJobAcceptanceAudits, listQuotesForJob } from '@/lib/queries/quotes';
import { customerDisplayName, formatDate, formatDateTime, formatPence } from '@/lib/utils/format';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AssignmentControl } from './assignment-control';
import { DeleteJobButton } from './delete-button';
import { StageTransition } from './stage-transition';
import { TagsPanel } from './tags-panel';

type Props = { params: Promise<{ id: string }> };

const ADMIN_ROLES = ['admin', 'super_admin'] as const;
const MANAGER_ROLES = ['manager', 'admin', 'super_admin'] as const;

export default async function JobPage({ params }: Props) {
  const { id } = await params;
  const me = await requireUser();
  const job = await getJobById(id);
  if (!job) notFound();

  const [history, tags, reps, surveyors, quotes, audits, calls, jobNotes, t] = await Promise.all([
    getJobStatusHistory(id),
    getJobTags(id),
    listSalesReps(),
    listSurveyors(),
    listQuotesForJob(id),
    getJobAcceptanceAudits(id),
    listPhoneCallsForJob(id),
    listNotesForJob(id),
    getTranslations('jobs'),
  ]);

  const isAdmin = (ADMIN_ROLES as readonly string[]).includes(me.role);
  const isManager = (MANAGER_ROLES as readonly string[]).includes(me.role);
  const defaultOccurredAt = new Date().toISOString().slice(0, 16);

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10">
      <nav className="text-sm text-[var(--color-muted-foreground)]">
        <Link href="/dashboard/jobs" className="hover:underline">
          {t('title')}
        </Link>
        <span className="mx-1.5">/</span>
        <span className="font-mono">{job.job_number}</span>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-mono text-2xl font-semibold tracking-tight">{job.job_number}</h1>
          <p className="mt-1 flex items-center gap-2 text-sm">
            <StageBadge stage={job.stage} />
            <span className="text-[var(--color-muted-foreground)]">
              · {t('createdOn', { date: formatDate(job.created_at) })}
            </span>
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/dashboard/jobs/${id}/quote/new`}
            className="rounded-md border bg-[var(--color-primary)] px-3 py-1.5 text-sm font-medium text-[var(--color-primary-foreground)] hover:opacity-90"
          >
            {t('buildQuote')}
          </Link>
          <Link
            href={`/dashboard/jobs/${id}/timeline`}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-[var(--color-muted)]"
          >
            {t('viewTimeline')}
          </Link>
          <Link
            href={`/dashboard/jobs/${id}/edit`}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-[var(--color-muted)]"
          >
            {t('edit')}
          </Link>
          {isAdmin ? <DeleteJobButton id={job.id} version={job.version} /> : null}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <aside className="flex flex-col gap-4">
          <Section title={t('customer')}>
            {job.customer ? (
              <DetailRow
                label={t('columns.customer')}
                value={
                  <Link
                    href={`/dashboard/customers/${job.customer.id}`}
                    className="hover:underline"
                  >
                    {customerDisplayName(job.customer)}
                  </Link>
                }
              />
            ) : (
              <DetailRow label={t('columns.customer')} value="—" />
            )}
            {job.customer?.primary_email ? (
              <DetailRow label={t('email')} value={job.customer.primary_email} />
            ) : null}
            {job.customer?.primary_phone ? (
              <DetailRow label={t('phone')} value={job.customer.primary_phone} />
            ) : null}
          </Section>

          <Section title={t('keyDates')}>
            <DetailRow label={t('moveDate')} value={formatDate(job.move_date)} />
            <DetailRow label={t('enquiryAt')} value={formatDate(job.enquiry_at)} />
            <DetailRow label={t('contactedAt')} value={formatDate(job.contacted_at)} />
            <DetailRow label={t('quotedAt')} value={formatDate(job.quoted_at)} />
            <DetailRow label={t('acceptedAt')} value={formatDate(job.accepted_at)} />
            <DetailRow label={t('confirmedAt')} value={formatDate(job.confirmed_at)} />
            <DetailRow label={t('completedAt')} value={formatDate(job.completed_at)} />
            <DetailRow label={t('paidAt')} value={formatDate(job.paid_at)} />
          </Section>

          <Section title={t('source')}>
            <DetailRow
              label={t('acquisitionSource')}
              value={job.acquisition_source ? t(`sources.${job.acquisition_source}` as never) : '—'}
            />
            <DetailRow label={t('value')} value={formatPence(job.quote_total_pence)} />
          </Section>

          <AssignmentControl
            id={job.id}
            version={job.version}
            assignedToId={job.assigned_to_id}
            reps={reps.map((r) => ({ id: r.id, full_name: r.full_name }))}
            canChange={isManager}
          />

          {job.notes ? (
            <Section title={t('notes')}>
              <p className="whitespace-pre-wrap text-sm">{job.notes}</p>
            </Section>
          ) : null}
        </aside>

        <section className="flex flex-col gap-6">
          <StageTransition
            id={job.id}
            version={job.version}
            stage={job.stage}
            isManager={isManager}
          />
          <TagsPanel jobId={job.id} tags={tags} />

          <QuotesPanel rows={quotes} audits={audits} />

          <NotesPanel jobId={job.id} rows={jobNotes} currentUserId={me.id} />

          <LogCallForm jobId={job.id} defaultOccurredAt={defaultOccurredAt} />

          <CallsPanel rows={calls} />

          <ActivityPanel history={history} />

          <PlaceholderTabs />

          {job.surveyor ? (
            <Section title={t('surveyor')}>
              <DetailRow label={t('assigned')} value={job.surveyor.full_name} />
            </Section>
          ) : null}

          {surveyors.length > 0 && job.surveyor === null && job.stage === 'survey_scheduled' ? (
            <p className="text-xs text-[var(--color-muted-foreground)]">{t('surveyorNeeded')}</p>
          ) : null}
        </section>
      </div>
    </main>
  );
}

async function ActivityPanel({
  history,
}: {
  history: Awaited<ReturnType<typeof getJobStatusHistory>>;
}) {
  const t = await getTranslations('jobs');
  return (
    <Section title={t('activity')}>
      {history.length === 0 ? (
        <p className="text-sm text-[var(--color-muted-foreground)]">{t('noActivity')}</p>
      ) : (
        <ol className="flex flex-col gap-2 text-sm">
          {history.map((entry) => (
            <li key={entry.id} className="flex flex-wrap items-baseline gap-2">
              <span className="font-mono text-xs text-[var(--color-muted-foreground)]">
                {formatDateTime(entry.changed_at)}
              </span>
              <span>
                {entry.from_stage ? `${entry.from_stage} → ` : ''}
                <strong>{entry.to_stage}</strong>
                {entry.reason ? ` · ${entry.reason}` : ''}
              </span>
              {entry.changed_by ? (
                <span className="text-[var(--color-muted-foreground)]">
                  ({entry.changed_by.full_name})
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </Section>
  );
}

async function PlaceholderTabs() {
  const t = await getTranslations('jobs');
  return (
    <Section title={t('comingSoon')}>
      <p className="text-sm text-[var(--color-muted-foreground)]">{t('comingSoonBody')}</p>
    </Section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border p-4">
      <h3 className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
        {title}
      </h3>
      <div className="mt-3 flex flex-col gap-2 text-sm">{children}</div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[var(--color-muted-foreground)]">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}
