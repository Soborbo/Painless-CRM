'use server';

import { serverEnv } from '@/lib/env';
import { sendQuoteAcceptedEmail } from '@/lib/integrations/resend/quote';
import { getPublicQuoteById } from '@/lib/queries/public-quote';
import { classifyAcceptable, pickClientIp } from '@/lib/quotes/public-acceptance';
import { verifyQuoteToken } from '@/lib/quotes/share-tokens';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { z } from 'zod';

export type AcceptQuoteState =
  | { status: 'idle' }
  | {
      status: 'error';
      reason:
        | 'invalid_token'
        | 'expired_token'
        | 'not_found'
        | 'already_accepted'
        | 'expired_validity'
        | 'declined'
        | 'expired_status'
        | 'unknown';
    }
  | { status: 'ok'; quote_id: string };

export const INITIAL_ACCEPT_QUOTE_STATE: AcceptQuoteState = { status: 'idle' };

const FormSchema = z.object({
  token: z.string().min(10),
  full_name: z.string().min(1).max(200),
  consent_terms: z.literal('on').or(z.literal('true')),
  variant_id: z
    .string()
    .uuid()
    .or(z.literal(''))
    .optional()
    .transform((v) => (v ? v : null)),
});

export async function acceptQuote(
  _prev: AcceptQuoteState,
  form: FormData,
): Promise<AcceptQuoteState> {
  const env = serverEnv();
  if (!env.QUOTE_LINK_SECRET) return { status: 'error', reason: 'invalid_token' };

  const parsed = FormSchema.safeParse({
    token: form.get('token'),
    full_name: form.get('full_name'),
    consent_terms: form.get('consent_terms'),
    variant_id: form.get('variant_id') ?? undefined,
  });
  if (!parsed.success) return { status: 'error', reason: 'invalid_token' };

  const verified = await verifyQuoteToken(parsed.data.token, env.QUOTE_LINK_SECRET);
  if (!verified.ok) {
    return {
      status: 'error',
      reason: verified.reason === 'expired' ? 'expired_token' : 'invalid_token',
    };
  }
  if (verified.payload.p !== 'accept') return { status: 'error', reason: 'invalid_token' };

  const quote = await getPublicQuoteById(verified.payload.q);
  if (!quote) return { status: 'error', reason: 'not_found' };

  const verdict = classifyAcceptable(quote);
  if (!verdict.ok) {
    return {
      status: 'error',
      reason:
        verdict.reason === 'already_accepted'
          ? 'already_accepted'
          : verdict.reason === 'declined'
            ? 'declined'
            : verdict.reason === 'expired_validity'
              ? 'expired_validity'
              : 'expired_status',
    };
  }

  const reqHeaders = await headers();
  const ipAddress = pickClientIp(reqHeaders) ?? '0.0.0.0';
  const userAgent = reqHeaders.get('user-agent')?.slice(0, 500) ?? null;

  const supabase = createAdminClient();

  // If variants exist on this quote, the customer MUST pick one — drop a token
  // missing variant_id so we never silently accept the headline price when
  // there are options. We compare to the live list rather than trusting the
  // submitted id alone.
  let variantId: string | null = null;
  const { data: variantRows } = await supabase
    .from('quote_variants')
    .select('id, total_pence')
    .eq('quote_id', quote.id);
  const variants = (variantRows ?? []) as Array<{ id: string; total_pence: number }>;
  let acceptedTotalPence: number | null = null;
  if (variants.length > 0) {
    if (!parsed.data.variant_id) return { status: 'error', reason: 'invalid_token' };
    const match = variants.find((v) => v.id === parsed.data.variant_id);
    if (!match) return { status: 'error', reason: 'invalid_token' };
    variantId = match.id;
    acceptedTotalPence = match.total_pence;
  }

  const { data: insertedAcceptance, error: acceptanceError } = await supabase
    .from('quote_acceptances')
    .insert({
      company_id: quote.company_id,
      quote_id: quote.id,
      variant_id: variantId,
      customer_id: quote.customer.id,
      acceptance_token: parsed.data.token,
      ip_address: ipAddress,
      user_agent: userAgent,
      consents: {
        terms_accepted: true,
        accepted_full_name: parsed.data.full_name.trim(),
      },
    })
    .select('id')
    .single();
  if (acceptanceError || !insertedAcceptance) return { status: 'error', reason: 'unknown' };

  const acceptedAt = new Date().toISOString();
  const quoteUpdate: Record<string, unknown> = { status: 'accepted' };
  if (acceptedTotalPence !== null) quoteUpdate.total_pence = acceptedTotalPence;
  const { error: quoteError } = await supabase
    .from('quotes')
    .update(quoteUpdate)
    .eq('id', quote.id)
    .in('status', ['draft', 'sent']);
  if (quoteError) return { status: 'error', reason: 'unknown' };

  const { data: jobRow } = await supabase
    .from('jobs')
    .select('stage, version')
    .eq('id', quote.job_id)
    .maybeSingle();

  if (
    jobRow &&
    (jobRow.stage === 'quoted' || jobRow.stage === 'lead' || jobRow.stage === 'contacted')
  ) {
    const fromStage = jobRow.stage as string;
    const fromVersion = jobRow.version as number;
    await supabase
      .from('jobs')
      .update({
        stage: 'accepted',
        accepted_at: acceptedAt,
        version: fromVersion + 1,
      })
      .eq('id', quote.job_id)
      .eq('version', fromVersion);

    await supabase.from('job_status_history').insert({
      company_id: quote.company_id,
      job_id: quote.job_id,
      from_stage: fromStage,
      to_stage: 'accepted',
      reason: `Customer accepted quote (${parsed.data.full_name.trim()})`,
    });
  }

  // Best-effort confirmation to the customer. The public quote never exposes
  // the email, so we look it up via the admin client here. A failure must not
  // undo the acceptance the customer just completed.
  try {
    const { data: cust } = await supabase
      .from('customers')
      .select('primary_email')
      .eq('id', quote.customer.id)
      .maybeSingle();
    const email = (cust?.primary_email as string | null) ?? null;
    if (email) {
      await sendQuoteAcceptedEmail({
        to: email,
        customerName: quote.customer.display_name,
        totalPence: acceptedTotalPence ?? quote.total_pence,
      });
    }
  } catch {
    // swallow — confirmation email is best-effort
  }

  revalidatePath(`/dashboard/jobs/${quote.job_id}`);
  return { status: 'ok', quote_id: quote.id };
}
