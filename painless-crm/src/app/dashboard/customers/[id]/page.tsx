import { requireUser } from '@/lib/auth/require-role';
import {
  getCustomerById,
  getCustomerJobs,
  getCustomerLifetimeValuePence,
} from '@/lib/queries/customers';
import { customerDisplayName, formatDate, formatPence } from '@/lib/utils/format';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DeleteCustomerButton } from './delete-button';

type Props = { params: Promise<{ id: string }> };

const ADMIN_ROLES = ['admin', 'super_admin', 'manager'] as const;

export default async function CustomerPage({ params }: Props) {
  const { id } = await params;
  const me = await requireUser();
  const customer = await getCustomerById(id);
  if (!customer) notFound();

  const [jobs, ltv, t] = await Promise.all([
    getCustomerJobs(id),
    getCustomerLifetimeValuePence(id),
    getTranslations('customers'),
  ]);
  const tj = await getTranslations('jobs');

  const lastJob = jobs[0];
  const isAdmin = (ADMIN_ROLES as readonly string[]).includes(me.role);

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10">
      <nav className="text-sm text-[var(--color-muted-foreground)]">
        <Link href="/dashboard/customers" className="hover:underline">
          {t('title')}
        </Link>
        <span className="mx-1.5">/</span>
        <span>{customerDisplayName(customer)}</span>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{customerDisplayName(customer)}</h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
            <span className="rounded-full bg-[var(--color-muted)] px-2 py-0.5 text-xs font-medium uppercase tracking-wide">
              {customer.customer_type}
            </span>
            <span>·</span>
            <span>{t('createdOn', { date: formatDate(customer.created_at) })}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/dashboard/customers/${id}/edit`}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-[var(--color-muted)]"
          >
            {t('edit')}
          </Link>
          {isAdmin ? <DeleteCustomerButton id={customer.id} version={customer.version} /> : null}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <aside className="flex flex-col gap-4">
          <Stat label={t('stats.ltv')} value={formatPence(ltv)} />
          <Stat label={t('stats.jobCount')} value={String(jobs.length)} />
          <Stat label={t('stats.lastJob')} value={lastJob ? formatDate(lastJob.created_at) : '—'} />

          <Section title={t('contactSection')}>
            <DetailRow label={t('fields.email')} value={customer.primary_email ?? '—'} />
            <DetailRow label={t('fields.phone')} value={customer.primary_phone ?? '—'} />
            {customer.customer_type === 'business' ? (
              <>
                <DetailRow label={t('fields.vatNumber')} value={customer.vat_number ?? '—'} />
                <DetailRow
                  label={t('fields.paymentTermsDays')}
                  value={customer.payment_terms_days?.toString() ?? '—'}
                />
              </>
            ) : null}
          </Section>

          <Section title={t('sourceSection')}>
            <DetailRow
              label={t('fields.acquisitionSource')}
              value={
                customer.acquisition_source
                  ? t(`sources.${customer.acquisition_source}` as never)
                  : '—'
              }
            />
            <DetailRow
              label={t('fields.marketingConsent')}
              value={customer.marketing_consent ? '✓' : '✗'}
            />
          </Section>

          {customer.notes ? (
            <Section title={t('fields.notes')}>
              <p className="whitespace-pre-wrap text-sm">{customer.notes}</p>
            </Section>
          ) : null}
        </aside>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-medium">{t('jobsTab')}</h2>
          {jobs.length === 0 ? (
            <p className="rounded-md border bg-[var(--color-muted)]/40 px-4 py-10 text-center text-sm text-[var(--color-muted-foreground)]">
              {t('noJobs')}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-left text-sm">
                <thead className="bg-[var(--color-muted)]">
                  <tr>
                    <th className="px-3 py-2 font-medium">{tj('columns.number')}</th>
                    <th className="px-3 py-2 font-medium">{tj('columns.stage')}</th>
                    <th className="px-3 py-2 font-medium">{tj('columns.moveDate')}</th>
                    <th className="px-3 py-2 font-medium">{tj('columns.value')}</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => (
                    <tr key={job.id} className="border-t">
                      <td className="px-3 py-2 font-mono">{job.job_number}</td>
                      <td className="px-3 py-2">{job.stage}</td>
                      <td className="px-3 py-2">{formatDate(job.move_date)}</td>
                      <td className="px-3 py-2">{formatPence(job.quote_total_pence)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-4">
      <p className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
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

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[var(--color-muted-foreground)]">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}
