import { SLABadge } from '@/components/domain/job/sla-badge';
import { StageBadge } from '@/components/domain/job/stage-badge';
import { TagChip } from '@/components/domain/job/tag-chip';
import {
  type JobAddressSummary,
  addressLine,
  pickMoveEndpoints,
  whatsappHref,
} from '@/lib/jobs/card-format';
import { computeSLAStatus } from '@/lib/jobs/sla';
import type { JobListRow } from '@/lib/queries/jobs';
import { customerDisplayName, formatDate, formatPence } from '@/lib/utils/format';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { JobCardActions } from './job-card-actions';

export async function JobCard({
  row,
  addresses,
  isAdmin,
}: {
  row: JobListRow;
  addresses: JobAddressSummary[];
  isAdmin: boolean;
}) {
  const t = await getTranslations('jobs');
  const { from, to } = pickMoveEndpoints(addresses);
  const wa = whatsappHref(row.customer?.primary_phone);
  const sla = computeSLAStatus({
    firstResponseDueAt: row.first_response_due_at,
    firstResponseAt: row.first_response_at,
    enquiryAt: row.enquiry_at,
  });

  return (
    <article className="group flex flex-col gap-3 rounded-xl border bg-[var(--color-background)] p-4 shadow-sm transition-all duration-200 hover:border-[var(--color-primary)]/40 hover:shadow-lg motion-safe:hover:-translate-y-0.5">
      <header className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/jobs/${row.id}`}
            className="rounded-md bg-[var(--color-muted)] px-2 py-0.5 font-mono text-xs font-medium hover:bg-[var(--color-muted)]/70"
          >
            {row.job_number}
          </Link>
          <SLABadge status={sla} />
        </div>
        <StageBadge stage={row.stage} />
      </header>

      <div>
        {row.customer ? (
          <Link
            href={`/dashboard/customers/${row.customer.id}`}
            className="text-base font-semibold tracking-tight hover:underline"
          >
            {customerDisplayName(row.customer)}
          </Link>
        ) : (
          <span className="text-base font-semibold">—</span>
        )}
        <div className="mt-1 flex flex-col gap-0.5 text-xs text-[var(--color-muted-foreground)]">
          {row.customer?.primary_email ? (
            <a
              href={`mailto:${row.customer.primary_email}`}
              className="truncate transition-colors hover:text-[var(--color-foreground)]"
            >
              ✉ {row.customer.primary_email}
            </a>
          ) : null}
          {row.customer?.primary_phone ? (
            <span className="flex items-center gap-1.5">
              <a
                href={`tel:${row.customer.primary_phone}`}
                className="transition-colors hover:text-[var(--color-foreground)]"
              >
                ☎ {row.customer.primary_phone}
              </a>
              {wa ? (
                <a
                  href={wa}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={t('whatsapp')}
                  title={t('whatsapp')}
                  className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-[10px] font-bold text-white transition-transform motion-safe:hover:scale-110"
                >
                  W
                </a>
              ) : null}
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <AddressBlock label={t('movingFromLabel')} addr={from} accent="border-sky-400" t={t} />
        <AddressBlock label={t('movingToLabel')} addr={to} accent="border-emerald-400" t={t} />
      </div>

      <dl className="grid grid-cols-3 gap-2 text-xs">
        <Fact label={t('moveDate')} value={formatDate(row.move_date)} />
        <Fact label={t('value')} value={formatPence(row.quote_total_pence)} />
        <Fact label={t('created')} value={formatDate(row.created_at)} />
      </dl>

      {row.tags.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {row.tags.map((tag) => (
            <TagChip key={tag} tag={tag} />
          ))}
        </div>
      ) : null}

      <footer className="mt-auto border-t pt-3">
        <JobCardActions id={row.id} version={row.version} stage={row.stage} isAdmin={isAdmin} />
      </footer>
    </article>
  );
}

function AddressBlock({
  label,
  addr,
  accent,
  t,
}: {
  label: string;
  addr: JobAddressSummary | null;
  accent: string;
  t: Awaited<ReturnType<typeof getTranslations<'jobs'>>>;
}) {
  const meta = addr
    ? [
        addr.property_type,
        addr.floor !== null ? t('floorN', { floor: addr.floor }) : null,
        addr.has_lift === true ? t('liftAvailable') : addr.has_lift === false ? t('noLift') : null,
      ].filter(Boolean)
    : [];
  return (
    <div className={`rounded-md border-l-2 ${accent} bg-[var(--color-muted)]/40 px-2.5 py-1.5`}>
      <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
        {label}
      </p>
      {addr ? (
        <>
          <p className="truncate text-xs font-medium" title={addressLine(addr)}>
            {addressLine(addr)}
          </p>
          {meta.length > 0 ? (
            <p className="truncate text-[11px] text-[var(--color-muted-foreground)]">
              {meta.join(' · ')}
            </p>
          ) : null}
        </>
      ) : (
        <p className="text-xs text-[var(--color-muted-foreground)]">{t('noAddressYet')}</p>
      )}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-[var(--color-muted)]/40 px-2 py-1.5">
      <dt className="text-[10px] uppercase tracking-wide text-[var(--color-muted-foreground)]">
        {label}
      </dt>
      <dd className="truncate font-medium tabular-nums">{value}</dd>
    </div>
  );
}
