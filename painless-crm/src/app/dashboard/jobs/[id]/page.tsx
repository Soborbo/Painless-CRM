import { DocumentVault } from '@/components/domain/document/document-vault';
import { CallsPanel } from '@/components/domain/job/calls-panel';
import { CustomFieldsPanel } from '@/components/domain/job/custom-fields-panel';
import { LogCallForm } from '@/components/domain/job/log-call-form';
import { NotesPanel } from '@/components/domain/job/notes-panel';
import { QuotesPanel } from '@/components/domain/job/quotes-panel';
import { RequoteButton } from '@/components/domain/job/requote-button';
import { StageBadge } from '@/components/domain/job/stage-badge';
import { TasksPanel } from '@/components/domain/job/tasks-panel';
import { requireUser } from '@/lib/auth/require-role';
import { isProfitReviewStage } from '@/lib/jobs/profit';
import { isRequoteEligibleStage } from '@/lib/jobs/requote';
import { listDocumentsForJob } from '@/lib/queries/documents';
import { getInvoicesForJob } from '@/lib/queries/invoices';
import { listTaskAssignees, listTasksForJob } from '@/lib/queries/job-tasks';
import {
  getJobById,
  getJobStatusHistory,
  getJobTags,
  listChildJobs,
  listSalesReps,
  listSurveyors,
} from '@/lib/queries/jobs';
import { listNotesForJob } from '@/lib/queries/notes';
import { listPhoneCallsForJob } from '@/lib/queries/phone-calls';
import { getJobAcceptanceAudits, listQuotesForJob } from '@/lib/queries/quotes';
import { type JobScheduleEntry, listAssignmentsForJob } from '@/lib/queries/rota';
import { pickHeadlineQuote } from '@/lib/quotes/headline';
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

  const [
    history,
    tags,
    reps,
    surveyors,
    quotes,
    audits,
    calls,
    jobNotes,
    jobTasks,
    jobDocuments,
    children,
    assignments,
    invoices,
    taskAssignees,
    t,
  ] = await Promise.all([
    getJobStatusHistory(id),
    getJobTags(id),
    listSalesReps(),
    listSurveyors(),
    listQuotesForJob(id),
    getJobAcceptanceAudits(id),
    listPhoneCallsForJob(id),
    listNotesForJob(id),
    listTasksForJob(id),
    listDocumentsForJob(id),
    listChildJobs(id),
    listAssignmentsForJob(id),
    getInvoicesForJob(id),
    listTaskAssignees(),
    getTranslations('jobs'),
  ]);

  const isAdmin = (ADMIN_ROLES as readonly string[]).includes(me.role);
  const isManager = (MANAGER_ROLES as readonly string[]).includes(me.role);
  const defaultOccurredAt = new Date().toISOString().slice(0, 16);
  const headline = pickHeadlineQuote(quotes);
  const canRequote = isRequoteEligibleStage(job.stage);
  const showProfitReview = isProfitReviewStage(job.stage) && isManager;

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
            href={`/dashboard/jobs/${id}/surveys`}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-[var(--color-muted)]"
          >
            {t('surveysTab')}
          </Link>
          <Link
            href={`/dashboard/jobs/${id}/invoices`}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-[var(--color-muted)]"
          >
            {t('invoicesTab')}
          </Link>
          <Link
            href={`/dashboard/jobs/${id}/complaints`}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-[var(--color-muted)]"
          >
            {t('complaintsTab')}
          </Link>
          <Link
            href={`/dashboard/jobs/${id}/damages`}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-[var(--color-muted)]"
          >
            {t('damagesTab')}
          </Link>
          {showProfitReview ? (
            <Link
              href={`/dashboard/jobs/${id}/profit-review`}
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-[var(--color-muted)]"
            >
              {t('profitReview')}
            </Link>
          ) : null}
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
            <DetailRow
              label={t('value')}
              value={
                headline ? (
                  <span>
                    {formatPence(headline.total_pence)}
                    {headline.status ? (
                      <span className="ml-1.5 text-xs text-[var(--color-muted-foreground)]">
                        ({t(`headlineStatus.${headline.status}` as never)})
                      </span>
                    ) : null}
                  </span>
                ) : (
                  '—'
                )
              }
            />
          </Section>

          <AssignmentControl
            id={job.id}
            version={job.version}
            assignedToId={job.assigned_to_id}
            reps={reps.map((r) => ({ id: r.id, full_name: r.full_name }))}
            canChange={isManager}
          />

          {job.parent || children.length > 0 ? (
            <Section title={t('requote.lineage')}>
              {job.parent ? (
                <DetailRow
                  label={t('requote.requotedFrom')}
                  value={
                    <Link
                      href={`/dashboard/jobs/${job.parent.id}`}
                      className="font-mono hover:underline"
                    >
                      {job.parent.job_number}
                    </Link>
                  }
                />
              ) : null}
              {children.map((child) => (
                <DetailRow
                  key={child.id}
                  label={t('requote.requotedTo')}
                  value={
                    <Link
                      href={`/dashboard/jobs/${child.id}`}
                      className="font-mono hover:underline"
                    >
                      {child.job_number}
                    </Link>
                  }
                />
              ))}
            </Section>
          ) : null}

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

          {canRequote ? (
            <Section title={t('requote.title')}>
              <RequoteButton jobId={job.id} />
            </Section>
          ) : null}

          <TasksPanel jobId={job.id} rows={jobTasks} assignees={taskAssignees} />

          <CustomFieldsPanel jobId={job.id} companyId={me.company_id} />

          <NotesPanel jobId={job.id} rows={jobNotes} currentUserId={me.id} />

          <DocumentVault parentType="job" parentId={job.id} rows={jobDocuments} />

          <LogCallForm jobId={job.id} defaultOccurredAt={defaultOccurredAt} />

          <CallsPanel rows={calls} />

          <SchedulePanel assignments={assignments} />

          <MoneyPanel jobId={job.id} invoices={invoices} />

          <ActivityPanel history={history} />

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

async function SchedulePanel({ assignments }: { assignments: JobScheduleEntry[] }) {
  const t = await getTranslations('jobs');
  return (
    <Section title={t('schedulePanel')}>
      {assignments.length === 0 ? (
        <p className="text-sm text-[var(--color-muted-foreground)]">{t('scheduleEmpty')}</p>
      ) : (
        <ol className="flex flex-col gap-2 text-sm">
          {assignments.map((a) => (
            <li key={a.id} className="flex flex-wrap items-baseline gap-2">
              <Link
                href={`/dashboard/rota/${a.date}`}
                className="font-mono text-xs hover:underline"
              >
                {formatDate(a.date)}
              </Link>
              <span>
                {a.worker_name}
                {a.role ? (
                  <span className="text-[var(--color-muted-foreground)]"> · {a.role}</span>
                ) : null}
              </span>
              {a.vehicle_registration ? (
                <span className="rounded bg-[var(--color-muted)] px-1.5 py-0.5 font-mono text-xs">
                  {a.vehicle_registration}
                </span>
              ) : null}
              {a.scheduled_start ? (
                <span className="font-mono text-xs text-[var(--color-muted-foreground)]">
                  {a.scheduled_start.slice(0, 5)}
                  {a.scheduled_end ? `–${a.scheduled_end.slice(0, 5)}` : ''}
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </Section>
  );
}

async function MoneyPanel({
  jobId,
  invoices,
}: {
  jobId: string;
  invoices: Awaited<ReturnType<typeof getInvoicesForJob>>;
}) {
  const t = await getTranslations('jobs');
  const invoicedPence = invoices.reduce((sum, i) => sum + i.total_pence, 0);
  const outstandingPence = invoices.reduce((sum, i) => sum + (i.amount_outstanding_pence ?? 0), 0);
  return (
    <Section title={t('moneyPanel')}>
      {invoices.length === 0 ? (
        <p className="text-sm text-[var(--color-muted-foreground)]">{t('moneyEmpty')}</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-4 text-sm">
            <DetailRow label={t('invoicedTotal')} value={formatPence(invoicedPence)} />
            <DetailRow label={t('outstandingTotal')} value={formatPence(outstandingPence)} />
          </div>
          <ol className="flex flex-col gap-1.5 text-sm">
            {invoices.map((inv) => (
              <li key={inv.id} className="flex flex-wrap items-baseline gap-2">
                <Link href={`/dashboard/invoices/${inv.id}`} className="font-mono hover:underline">
                  {inv.invoice_number}
                </Link>
                {inv.status ? (
                  <span className="rounded bg-[var(--color-muted)] px-1.5 py-0.5 text-xs">
                    {inv.status}
                  </span>
                ) : null}
                <span className="ml-auto tabular-nums">{formatPence(inv.total_pence)}</span>
              </li>
            ))}
          </ol>
        </>
      )}
      <Link
        href={`/dashboard/jobs/${jobId}/invoices`}
        className="text-xs text-[var(--color-muted-foreground)] hover:underline"
      >
        {t('invoicesTab')} →
      </Link>
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
