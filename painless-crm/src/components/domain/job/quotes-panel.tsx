import {
  type QuoteAcceptanceAudit,
  type QuoteRow,
  classifyQuoteValidity,
} from '@/lib/queries/quotes';
import { summariseUserAgent } from '@/lib/quotes/acceptance-ua';
import { computeRevisionDeltas } from '@/lib/quotes/revision-delta';
import { formatDateTime, formatPence } from '@/lib/utils/format';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { SendQuoteButton } from './send-quote-button';
import { WithdrawQuoteButton } from './withdraw-quote-button';

const REVISABLE_STATUSES: ReadonlySet<NonNullable<QuoteRow['status']>> = new Set([
  'draft',
  'sent',
  'declined',
  'expired',
]);

const VALIDITY_CLASS = {
  fresh: 'bg-green-50 text-green-800',
  expiring_soon: 'bg-yellow-50 text-yellow-900',
  expired: 'bg-zinc-100 text-zinc-700',
} as const;

const STATUS_CLASS: Record<NonNullable<QuoteRow['status']>, string> = {
  draft: 'bg-zinc-100 text-zinc-800',
  sent: 'bg-sky-50 text-sky-800',
  accepted: 'bg-green-50 text-green-800',
  declined: 'bg-red-50 text-red-800',
  expired: 'bg-zinc-100 text-zinc-700',
};

export async function QuotesPanel({
  rows,
  audits = [],
}: {
  rows: QuoteRow[];
  audits?: QuoteAcceptanceAudit[];
}) {
  const t = await getTranslations('quotes');

  if (rows.length === 0) {
    return (
      <Section title={t('panelTitle')}>
        <p className="text-sm text-[var(--color-muted-foreground)]">{t('empty')}</p>
      </Section>
    );
  }

  const auditByQuote = new Map(audits.map((a) => [a.quote_id, a] as const));
  const annotated = computeRevisionDeltas(rows);

  return (
    <Section title={t('panelTitle')}>
      <ul className="flex flex-col divide-y">
        {annotated.map(({ row, delta_pence }) => {
          const validity = classifyQuoteValidity(row.valid_until);
          const sizeLabel = row.size_code ?? '—';
          const canRevise = row.status ? REVISABLE_STATUSES.has(row.status) : false;
          return (
            <li key={row.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-base font-semibold">{formatPence(row.total_pence)}</span>
                <span className="text-xs text-[var(--color-muted-foreground)]">
                  {formatDateTime(row.created_at)}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                {row.status ? (
                  <span
                    className={`rounded-md px-1.5 py-0.5 font-medium ${STATUS_CLASS[row.status]}`}
                  >
                    {t(`status.${row.status}` as never)}
                  </span>
                ) : null}
                {row.revision_number > 1 ? (
                  <span className="rounded-md bg-purple-50 px-1.5 py-0.5 font-medium text-purple-800">
                    {t('revisionBadge', { number: row.revision_number })}
                  </span>
                ) : null}
                {delta_pence !== null && delta_pence !== 0 ? (
                  <span
                    className={`rounded-md px-1.5 py-0.5 font-medium ${
                      delta_pence > 0
                        ? 'bg-amber-50 text-amber-900'
                        : 'bg-emerald-50 text-emerald-900'
                    }`}
                    title={t('deltaTooltip')}
                  >
                    {delta_pence > 0 ? '+' : '−'}
                    {formatPence(Math.abs(delta_pence))}
                  </span>
                ) : delta_pence === 0 ? (
                  <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 font-medium text-zinc-700">
                    {t('deltaSame')}
                  </span>
                ) : null}
                <span
                  className={`rounded-md px-1.5 py-0.5 font-medium ${VALIDITY_CLASS[validity]}`}
                >
                  {t(`validity.${validity}` as never)}
                </span>
                <span className="text-[var(--color-muted-foreground)]">
                  · {sizeLabel}
                  {row.distance_miles !== null ? ` · ${row.distance_miles}mi` : ''}
                </span>
              </div>
              <div className="text-xs text-[var(--color-muted-foreground)]">
                {t('versionLine', {
                  label: row.pricing_version?.version_label ?? '—',
                  validUntil: formatDateTime(row.valid_until),
                })}
              </div>
              {row.complications && row.complications.length > 0 ? (
                <div className="text-xs text-[var(--color-muted-foreground)]">
                  {t('complicationsLine', { items: row.complications.join(', ') })}
                </div>
              ) : null}
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {row.status === 'draft' ? (
                  <SendQuoteButton quoteId={row.id} version={row.version} />
                ) : null}
                {canRevise ? (
                  <Link
                    href={`/dashboard/jobs/${row.job_id}/quote/new?from=${row.id}`}
                    className="rounded-md border px-2 py-1 text-xs hover:bg-[var(--color-muted)]"
                  >
                    {t('reviseAction')}
                  </Link>
                ) : null}
                <Link
                  href={`/dashboard/jobs/${row.job_id}/quote/${row.id}`}
                  className="rounded-md border px-2 py-1 text-xs hover:bg-[var(--color-muted)]"
                >
                  {t('detailsAction')}
                </Link>
                {row.status === 'draft' || row.status === 'sent' ? (
                  <WithdrawQuoteButton quoteId={row.id} />
                ) : null}
              </div>
              {row.status === 'sent' && row.sent_at ? (
                <div className="text-xs text-[var(--color-muted-foreground)]">
                  {t('sentAtLine', { at: formatDateTime(row.sent_at) })}
                </div>
              ) : null}
              {row.first_opened_at ? (
                <div className="text-xs text-[var(--color-muted-foreground)]">
                  {t('openedLine', {
                    first: formatDateTime(row.first_opened_at),
                    count: row.open_count,
                  })}
                </div>
              ) : row.status === 'sent' ? (
                <div className="text-xs text-[var(--color-muted-foreground)]">{t('notOpened')}</div>
              ) : null}
              {row.status === 'declined' && row.declined_at ? (
                <div className="text-xs text-red-700">
                  {t('declinedLine', { at: formatDateTime(row.declined_at) })}
                  {row.decline_reason ? ` — "${row.decline_reason}"` : ''}
                </div>
              ) : null}
              {row.withdrawn_at ? (
                <div className="text-xs text-amber-800">
                  {t('withdrawnLine', { at: formatDateTime(row.withdrawn_at) })}
                  {row.withdrawal_reason ? ` — "${row.withdrawal_reason}"` : ''}
                </div>
              ) : null}
              {(() => {
                const audit = row.status === 'accepted' ? auditByQuote.get(row.id) : undefined;
                return audit ? <AcceptanceAudit audit={audit} t={t} /> : null;
              })()}
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

function AcceptanceAudit({
  audit,
  t,
}: {
  audit: QuoteAcceptanceAudit;
  t: Awaited<ReturnType<typeof getTranslations<'quotes'>>>;
}) {
  const ua = summariseUserAgent(audit.user_agent);
  return (
    <div className="mt-1 rounded-md bg-green-50 px-2 py-1.5 text-xs text-green-900">
      <p className="font-medium">
        {t('acceptedByLine', {
          name: audit.acceptor_name ?? t('acceptedAnonymous'),
          at: formatDateTime(audit.accepted_at),
        })}
      </p>
      {ua ? (
        <p className="text-[11px] text-green-800" title={ua.full}>
          {t('acceptedFromDevice', { device: ua.short })}
        </p>
      ) : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border p-4">
      <h3 className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
        {title}
      </h3>
      <div className="mt-3 text-sm">{children}</div>
    </div>
  );
}
