import { serverEnv } from '@/lib/env';
import { getPublicQuoteById } from '@/lib/queries/public-quote';
import { listPublicVariantsForQuote } from '@/lib/queries/quote-variants';
import { getBrandingByCompanyId } from '@/lib/queries/settings';
import { extractPublicBreakdown } from '@/lib/quotes/public-breakdown';
import { verifyQuoteToken } from '@/lib/quotes/share-tokens';
import { resolveBranding } from '@/lib/settings/branding';
import { formatDate, formatPence } from '@/lib/utils/format';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

// Print-friendly view for browsers to "Save as PDF". Wired as the fallback
// until the Cloudflare Browser Rendering binding is in place — at that point
// a server-side capture of this same page will write quotes.pdf_url, so the
// HTML stays the canonical source and the PDF path is a deploy concern.

type Props = { params: Promise<{ token: string }> };

export const dynamic = 'force-dynamic';

export default async function PrintQuotePage({ params }: Props) {
  const { token } = await params;
  const env = serverEnv();
  if (!env.QUOTE_LINK_SECRET) notFound();

  const verified = await verifyQuoteToken(token, env.QUOTE_LINK_SECRET);
  if (!verified.ok) notFound();

  const quote = await getPublicQuoteById(verified.payload.q);
  if (!quote) notFound();

  const t = await getTranslations('publicQuote');
  const tp = await getTranslations('printQuote');
  const details = extractPublicBreakdown(quote.breakdown);
  const variants = await listPublicVariantsForQuote(quote.id);
  const sizeLabel = details.size_label ?? quote.size_code ?? '—';
  const branding = resolveBranding(
    await getBrandingByCompanyId(quote.company_id),
    quote.company.name,
  );

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-8 py-10 print:px-0 print:py-0">
      {/* Brand tick: a 2px rule in the tenant's brand colour. */}
      <div className="h-0.5 w-full" style={{ backgroundColor: branding.brandColor }} aria-hidden />
      <header className="border-b pb-4">
        <div className="flex items-center gap-3">
          {branding.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- arbitrary tenant logo URL, not a bundled asset
            <img src={branding.logoUrl} alt={branding.companyName} className="h-9 w-auto" />
          ) : null}
          <p className="text-xs uppercase tracking-wide text-zinc-500">{branding.companyName}</p>
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{tp('title')}</h1>
        <p className="mt-1 text-sm text-zinc-600">
          {tp('subhead', {
            jobNumber: quote.job.job_number,
            customer: quote.customer.display_name,
          })}
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          {tp('printedOn', { at: formatDate(new Date()) })}
        </p>
      </header>

      <section className="rounded-md border border-zinc-300 p-5">
        <p className="text-xs uppercase tracking-wide text-zinc-500">{t('priceLabel')}</p>
        <p className="mt-1 text-3xl font-semibold">{formatPence(quote.total_pence)}</p>
        <p className="mt-1 text-xs text-zinc-500">
          {tp('validUntil', { at: formatDate(quote.valid_until) })}
        </p>
      </section>

      {variants.length > 0 ? (
        <section className="rounded-md border border-zinc-300 p-5 print:break-inside-avoid">
          <h2 className="text-sm font-semibold uppercase tracking-wide">{tp('options')}</h2>
          <p className="mt-1 text-xs text-zinc-500">{tp('optionsHint')}</p>
          <ul className="mt-3 flex flex-col divide-y divide-zinc-200">
            {variants.map((v) => (
              <li key={v.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                <div className="flex flex-col">
                  <span className="font-medium">{v.variant_label}</span>
                  {v.description ? (
                    <span className="text-xs text-zinc-600">{v.description}</span>
                  ) : null}
                </div>
                <span className="font-mono text-sm">{formatPence(v.total_pence)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide">{tp('whatsIncluded')}</h2>
        <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
          <Row label={t('size')} value={sizeLabel} />
          {details.crew_size !== null ? (
            <Row label={t('crew')} value={t('crewValue', { count: details.crew_size })} />
          ) : null}
          {details.total_estimated_hours !== null ? (
            <Row
              label={t('estimatedTime')}
              value={t('hoursValue', { hours: details.total_estimated_hours })}
            />
          ) : null}
          {quote.distance_miles !== null ? (
            <Row label={t('distance')} value={t('miles', { miles: quote.distance_miles })} />
          ) : null}
          {quote.job.move_date ? (
            <Row label={t('moveDate')} value={formatDate(quote.job.move_date)} />
          ) : null}
        </dl>
        {quote.complications && quote.complications.length > 0 ? (
          <p className="mt-3 text-sm text-zinc-600">
            {t('complications', { items: quote.complications.join(', ') })}
          </p>
        ) : null}
        {details.requires_survey ? (
          <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {t('surveyHint')}
          </p>
        ) : null}
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide">{tp('howToAccept')}</h2>
        <p className="mt-2 text-sm text-zinc-700">{tp('howToAcceptBody')}</p>
      </section>

      <footer className="mt-auto border-t pt-3 text-xs text-zinc-500">{tp('footer')}</footer>
    </main>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <>
      <dt className="text-zinc-500">{label}</dt>
      <dd>{value}</dd>
    </>
  );
}
