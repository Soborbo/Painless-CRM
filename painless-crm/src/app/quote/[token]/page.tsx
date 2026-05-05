import { serverEnv } from '@/lib/env';
import { getPublicQuoteById } from '@/lib/queries/public-quote';
import { expireSingleQuote, shouldExpire } from '@/lib/quotes/expiry';
import { classifyAcceptable } from '@/lib/quotes/public-acceptance';
import { verifyQuoteToken } from '@/lib/quotes/share-tokens';
import { formatDate, formatPence } from '@/lib/utils/format';
import { getTranslations } from 'next-intl/server';
import { AcceptQuoteForm } from './accept-form';

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

  const verdict = classifyAcceptable(quote);
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
          {quote.size_code ? (
            <>
              <dt className="text-[var(--color-muted-foreground)]">{t('size')}</dt>
              <dd>{quote.size_code}</dd>
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
          <dt className="text-[var(--color-muted-foreground)]">{t('pricingVersion')}</dt>
          <dd>{quote.pricing_version_label}</dd>
        </dl>
        {quote.complications && quote.complications.length > 0 ? (
          <p className="mt-4 text-sm text-[var(--color-muted-foreground)]">
            {t('complications', { items: quote.complications.join(', ') })}
          </p>
        ) : null}
      </section>

      {verdict.ok ? (
        <AcceptQuoteForm token={token} customerName={quote.customer.display_name} />
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

      <footer className="text-xs text-[var(--color-muted-foreground)]">{t('footer')}</footer>
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
