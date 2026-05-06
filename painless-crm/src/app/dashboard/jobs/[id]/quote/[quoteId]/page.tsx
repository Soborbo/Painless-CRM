import { VariantsEditor } from '@/components/domain/job/variants-editor';
import { requireUser } from '@/lib/auth/require-role';
import { getJobById } from '@/lib/queries/jobs';
import { getQuoteDetail } from '@/lib/queries/quote-detail';
import { listVariantsForQuote } from '@/lib/queries/quote-variants';
import { summariseInternalCost } from '@/lib/quotes/internal-breakdown';
import { formatDateTime, formatPence } from '@/lib/utils/format';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';

const VARIANT_ROLES = new Set(['sales', 'manager', 'admin', 'super_admin']);

type Props = { params: Promise<{ id: string; quoteId: string }> };

export const dynamic = 'force-dynamic';

export default async function QuoteDetailPage({ params }: Props) {
  const { id, quoteId } = await params;
  const me = await requireUser();
  const [job, quote, variants, t, tv] = await Promise.all([
    getJobById(id),
    getQuoteDetail(id, quoteId),
    listVariantsForQuote(quoteId),
    getTranslations('quotes'),
    getTranslations('variants'),
  ]);
  if (!job || !quote) notFound();
  const canEditVariants =
    VARIANT_ROLES.has(me.role) && (quote.status === 'draft' || quote.status === 'sent');

  const internal = summariseInternalCost(quote.pricing_snapshot);
  const breakdown = quote.breakdown ?? {};
  const sizeLabel = (breakdown.size_label as string | null) ?? quote.size_code ?? '—';
  const crewSize = (breakdown.crew_size as number | null) ?? null;
  const estHours = (breakdown.estimated_hours as number | null) ?? null;
  const addedHours = (breakdown.hours_added_for_complications as number | null) ?? 0;

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10">
      <nav className="text-sm text-[var(--color-muted-foreground)]">
        <Link href={`/dashboard/jobs/${id}`} className="hover:underline">
          {job.job_number}
        </Link>
        <span className="mx-1.5">/</span>
        <span>{t('detailTitle')}</span>
      </nav>

      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {formatPence(quote.total_pence)}
          </h1>
          <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
            {quote.status ? t(`status.${quote.status}` as never) : '—'}
            {quote.revision_number > 1
              ? ` · ${t('revisionBadge', { number: quote.revision_number })}`
              : ''}
            {quote.pricing_version
              ? ` · ${t('builderAgainst')} ${quote.pricing_version.version_label}`
              : ''}
          </p>
        </div>
      </header>

      <Section title={t('detailInputs')}>
        <DetailRow label={t('builderSize')} value={sizeLabel} />
        <DetailRow
          label={t('builderDistance')}
          value={quote.distance_miles !== null ? `${quote.distance_miles}` : '—'}
        />
        <DetailRow label={t('detailCrew')} value={crewSize !== null ? `${crewSize}` : '—'} />
        <DetailRow
          label={t('detailHours')}
          value={
            estHours !== null
              ? addedHours > 0
                ? t('detailHoursWithExtra', { base: estHours, extra: addedHours })
                : `${estHours}`
              : '—'
          }
        />
        {quote.complications && quote.complications.length > 0 ? (
          <DetailRow label={t('builderComplications')} value={quote.complications.join(', ')} />
        ) : null}
      </Section>

      <Section title={t('detailCostBreakdown')}>
        {internal.rows.length === 0 ? (
          <p className="text-sm text-[var(--color-muted-foreground)]">{t('detailNoSnapshot')}</p>
        ) : (
          <ul className="flex flex-col gap-1.5 text-sm">
            {internal.rows.map((row) => (
              <li key={row.key} className="flex items-baseline justify-between">
                <span className="text-[var(--color-muted-foreground)]">
                  {t(`detailCost.${row.key}` as never)}
                </span>
                <span className="font-mono">{formatPence(row.pence)}</span>
              </li>
            ))}
            <li className="mt-1 flex items-baseline justify-between border-t pt-2 font-semibold">
              <span>{t('detailTotal')}</span>
              <span className="font-mono">{formatPence(quote.total_pence)}</span>
            </li>
          </ul>
        )}
        {internal.margin_pct !== null ? (
          <p className="mt-3 text-xs text-[var(--color-muted-foreground)]">
            {t('detailMargin', { pct: Math.round(internal.margin_pct * 1000) / 10 })}
            {internal.margin_modulated ? ` · ${t('detailMarginModulated')}` : ''}
            {internal.capacity_band
              ? ` · ${t('detailCapacityBand', { band: internal.capacity_band })}`
              : ''}
          </p>
        ) : null}
      </Section>

      <Section title={tv('panelTitle')}>
        <VariantsEditor quoteId={quote.id} variants={variants} canEdit={canEditVariants} />
      </Section>

      <Section title={t('detailLifecycle')}>
        <DetailRow label={t('detailCreated')} value={formatDateTime(quote.created_at)} />
        <DetailRow
          label={t('sentLabel')}
          value={quote.sent_at ? formatDateTime(quote.sent_at) : '—'}
        />
        <DetailRow
          label={t('detailFirstOpened')}
          value={
            quote.first_opened_at
              ? `${formatDateTime(quote.first_opened_at)} · ${quote.open_count}×`
              : '—'
          }
        />
        <DetailRow
          label={t('detailAccepted')}
          value={
            quote.acceptance
              ? [
                  formatDateTime(quote.acceptance.accepted_at),
                  quote.acceptance.acceptor_name,
                  quote.acceptance.variant_label
                    ? t('detailAcceptedVariant', { label: quote.acceptance.variant_label })
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ')
              : '—'
          }
        />
        <DetailRow
          label={t('detailDeclined')}
          value={
            quote.declined_at
              ? `${formatDateTime(quote.declined_at)}${quote.decline_reason ? ` — "${quote.decline_reason}"` : ''}`
              : '—'
          }
        />
        <DetailRow
          label={t('detailWithdrawn')}
          value={
            quote.withdrawn_at
              ? [
                  formatDateTime(quote.withdrawn_at),
                  quote.withdrawn_by_name,
                  quote.withdrawal_reason ? `"${quote.withdrawal_reason}"` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')
              : '—'
          }
        />
        <DetailRow label={t('detailValidUntil')} value={formatDateTime(quote.valid_until)} />
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-md border p-4">
      <h2 className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
        {title}
      </h2>
      <div className="mt-3 flex flex-col gap-2">{children}</div>
    </section>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-[var(--color-muted-foreground)]">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}
