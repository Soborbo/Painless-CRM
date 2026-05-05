'use server';

import { serverEnv } from '@/lib/env';
import { getPublicQuoteById } from '@/lib/queries/public-quote';
import { parseDeclineForm } from '@/lib/quotes/decline-form';
import { classifyAcceptable } from '@/lib/quotes/public-acceptance';
import { verifyQuoteToken } from '@/lib/quotes/share-tokens';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

export type DeclineQuoteState =
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

export const INITIAL_DECLINE_QUOTE_STATE: DeclineQuoteState = { status: 'idle' };

export async function declineQuote(
  _prev: DeclineQuoteState,
  form: FormData,
): Promise<DeclineQuoteState> {
  const env = serverEnv();
  if (!env.QUOTE_LINK_SECRET) return { status: 'error', reason: 'invalid_token' };

  const parsed = parseDeclineForm({
    token: form.get('token'),
    reason: form.get('reason'),
  });
  if (!parsed.ok) return { status: 'error', reason: 'invalid_token' };

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

  const supabase = createAdminClient();
  const declinedAt = new Date().toISOString();
  const { error } = await supabase
    .from('quotes')
    .update({
      status: 'declined',
      declined_at: declinedAt,
      decline_reason: parsed.data.reason,
    })
    .eq('id', quote.id)
    .in('status', ['draft', 'sent']);
  if (error) return { status: 'error', reason: 'unknown' };

  revalidatePath(`/dashboard/jobs/${quote.job_id}`);
  return { status: 'ok', quote_id: quote.id };
}
