import { formatFileSize } from '@/lib/documents/storage-path';
import { serverEnv } from '@/lib/env';
import { getDocumentTextByCompanyId } from '@/lib/queries/customisation';
import { listPublicDocumentsForQuote, signPublicDocuments } from '@/lib/queries/documents';
import { getPublicQuoteById } from '@/lib/queries/public-quote';
import { listPublicVariantsForQuote } from '@/lib/queries/quote-variants';
import { expireSingleQuote, shouldExpire } from '@/lib/quotes/expiry';
import { recordQuoteOpen } from '@/lib/quotes/opens';
import { classifyAcceptable } from '@/lib/quotes/public-acceptance';
import { extractPublicBreakdown } from '@/lib/quotes/public-breakdown';
import { verifyQuoteToken } from '@/lib/quotes/share-tokens';
import { formatDate, formatPence } from '@/lib/utils/format';
import { getTranslations } from 'next-intl/server';
import { AcceptQuoteForm } from './accept-form';
import { DeclineQuoteForm } from './decline-form';

type Props = { params: Promise<{ token: string }> };

export const dynamic = 'force-dynamic';

export default async function PublicQuotePage({ params }: Props) {
  const { token } = await params;
  const t = await getTranslations('publicQuote');
  const env = serverEnv();
  if (!env.QUOTE_LINK_SECRET)
    return <Message title={t('unavailable')} body={t('unavailableBody')} />;

  const verified = await verifyQuoteToken(token, env.QUOTE_LINK_SECRET);
  if (!verified.ok) {
    return (
      <Message
        title={verified.reason === 'expired' ? t('expiredTitle') : t('invalidTitle')}
        body={verified.reason === 'expired' ? t('expiredBody') : t('invalidBody')}
      />
    );
  }

  let quote = await getPublicQuoteById(verified.payload.q);
  if (!quote) return <Message title={t('notFoundTitle')} body={t('notFoundBody')} />;

  if (shouldExpire(quote.status, quote.valid_until)) {
    const flipped = await expireSingleQuote(quote.id);
    if (flipped) quote = { ...quote, status: 'expired' };
  }

  await recordQuoteOpen(quote.id);

  const [details, variants] = [
    extractPublicBreakdown(quote.breakdown),
    await listPublicVariantsForQuote(quote.id),
  ];
  const documents = await signPublicDocuments(
    await listPublicDocumentsForQuote(quote.id, quote.job_id, quote.customer.id),
  );
  const verdict = classifyAcceptable(quote);
  const documentText = await getDocumentTextByCompanyId(quote.company_id);
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 px-6 py-10">
      <header className="border-b pb-6">
        <p className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
          {quote.company.name}
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          {t('headline', { name: quote.customer.display_name })}
        </h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          {t('subhead', {
            jobNumber: quote.job.job_number,
            validUntil: formatDate(quote.valid_until),
          })}
        </p>
      </header>

      <section className="rounded-md border p-6">
        <p className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
          {t('priceLabel')}
        </p>
        <p className="mt-1 text-4xl font-semibold">{formatPence(quote.total_pence)}</p>
        <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
          {(details.size_label ?? quote.size_code) ? (
            <>
              <dt className="text-[var(--color-muted-foreground)]">{t('size')}</dt>
              <dd>{details.size_label ?? quote.size_code}</dd>
            </>
          ) : null}
          {details.crew_size !== null ? (
            <>
              <dt className="text-[var(--color-muted-foreground)]">{t('crew')}</dt>
              <dd>{t('crewValue', { count: details.crew_size })}</dd>
            </>
          ) : null}
          {details.total_estimated_hours !== null ? (
            <>
              <dt className="text-[var(--color-muted-foreground)]">{t('estimatedTime')}</dt>
              <dd>{t('hoursValue', { hours: details.total_estimated_hours })}</dd>
            </>
          ) : null}
          {quote.distance_miles !== null ? (
            <>
              <dt className="text-[var(--color-muted-foreground)]">{t('distance')}</dt>
              <dd>{t('miles', { miles: quote.distance_miles })}</dd>
            </>
          ) : null}
          {quote.job.move_date ? (
            <>
              <dt className="text-[var(--color-muted-foreground)]">{t('moveDate')}</dt>
              <dd>{formatDate(quote.job.move_date)}</dd>
            </>
          ) : null}
        </dl>
        {quote.complications && quote.complications.length > 0 ? (
          <p className="mt-4 text-sm text-[var(--color-muted-foreground)]">
            {t('complications', { items: quote.complications.join(', ') })}
          </p>
        ) : null}
        {details.requires_survey ? (
          <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {t('surveyHint')}
          </p>
        ) : null}
      </section>

      {variants.length > 0 ? (
        <section className="rounded-md border p-6">
          <p className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
            {t('variantsHeader')}
          </p>
          <ul className="mt-3 flex flex-col divide-y">
            {variants.map((v) => (
              <li key={v.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                <div className="flex flex-col">
                  <span className="font-medium">{v.variant_label}</span>
                  {v.description ? (
                    <span className="text-xs text-[var(--color-muted-foreground)]">
                      {v.description}
                    </span>
                  ) : null}
                </div>
                <span className="font-mono text-sm">{formatPence(v.total_pence)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {documents.length > 0 ? (
        <section className="rounded-md border p-6">
          <p className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
            {t('documentsHeader')}
          </p>
          <ul className="mt-3 flex flex-col divide-y">
            {documents.map((doc) => (
              <li key={doc.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="font-medium text-[var(--color-primary)] underline"
                >
                  {doc.file_name}
                </a>
                <span className="text-xs text-[var(--color-muted-foreground)]">
                  {formatFileSize(doc.file_size_bytes)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {verdict.ok ? (
        <>
          <AcceptQuoteForm
            token={token}
            customerName={quote.customer.display_name}
            variants={variants.map((v) => ({
              id: v.id,
              label: v.variant_label,
              total_pence: v.total_pence,
            }))}
          />
          <DeclineQuoteForm token={token} />
        </>
      ) : (
        <Message
          title={
            verdict.reason === 'already_accepted'
              ? t('alreadyAcceptedTitle')
              : verdict.reason === 'expired_validity' || verdict.reason === 'expired_status'
                ? t('expiredTitle')
                : t('declinedTitle')
          }
          body={
            verdict.reason === 'already_accepted'
              ? t('alreadyAcceptedBody')
              : verdict.reason === 'expired_validity' || verdict.reason === 'expired_status'
                ? t('expiredBody')
                : t('declinedBody')
          }
          inline
        />
      )}

      {documentText.acceptance_terms ? (
        <section className="rounded-md border border-[var(--color-border)] bg-[var(--color-muted)]/20 p-4 text-xs text-[var(--color-muted-foreground)]">
          <p className="whitespace-pre-wrap">{documentText.acceptance_terms}</p>
        </section>
      ) : null}

      <footer className="flex items-center justify-between text-xs text-[var(--color-muted-foreground)]">
        <span>{documentText.quote_footer || t('footer')}</span>
        <a
          href={`/quote/${token}/print`}
          target="_blank"
          rel="noreferrer noopener"
          className="underline"
        >
          {t('printLink')}
        </a>
      </footer>
    </main>
  );
}

function Message({ title, body, inline }: { title: string; body: string; inline?: boolean }) {
  if (inline) {
    return (
      <section className="rounded-md border border-dashed p-6">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{body}</p>
      </section>
    );
  }
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col items-start gap-3 px-6 py-10">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="text-sm text-[var(--color-muted-foreground)]">{body}</p>
    </main>
  );
}
