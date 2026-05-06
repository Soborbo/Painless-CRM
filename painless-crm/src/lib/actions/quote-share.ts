'use server';

import { requireRole } from '@/lib/auth/require-role';
import { serverEnv } from '@/lib/env';
import { signQuoteToken } from '@/lib/quotes/share-tokens';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

// Mints a fresh share URL for an already-sent quote without changing its
// status. Useful when the rep loses the original send email or wants to
// resend manually. The token's TTL is recomputed off the quote's current
// validity so a fresh link never outlives the quote.

const RESHARE_ROLES = ['sales', 'manager', 'admin', 'super_admin'] as const;

const InputSchema = z.object({ quote_id: z.string().uuid() });

export type ReshareQuoteState =
  | { status: 'idle' }
  | {
      status: 'error';
      reason: 'invalid_input' | 'not_found' | 'wrong_status' | 'no_secret' | 'unknown';
    }
  | { status: 'ok'; quote_id: string; share_url: string };

export const INITIAL_RESHARE_STATE: ReshareQuoteState = { status: 'idle' };

export async function reshareQuote(
  _prev: ReshareQuoteState,
  form: FormData,
): Promise<ReshareQuoteState> {
  await requireRole(RESHARE_ROLES);

  const parsed = InputSchema.safeParse({ quote_id: form.get('quote_id') });
  if (!parsed.success) return { status: 'error', reason: 'invalid_input' };

  const env = serverEnv();
  if (!env.QUOTE_LINK_SECRET) return { status: 'error', reason: 'no_secret' };

  const supabase = await createClient();
  const { data: row } = await supabase
    .from('quotes')
    .select('id, status, valid_until')
    .eq('id', parsed.data.quote_id)
    .is('deleted_at', null)
    .maybeSingle();

  if (!row) return { status: 'error', reason: 'not_found' };
  if (row.status !== 'sent') return { status: 'error', reason: 'wrong_status' };

  const validUntilMs = new Date(row.valid_until as string).getTime();
  const ttlSeconds = Math.max(
    60 * 60,
    Math.floor((validUntilMs - Date.now()) / 1000) + 24 * 60 * 60,
  );
  const token = await signQuoteToken(
    { quoteId: row.id as string, purpose: 'accept', ttlSeconds },
    env.QUOTE_LINK_SECRET,
  );
  const shareUrl = `${env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')}/quote/${token}`;
  return { status: 'ok', quote_id: row.id as string, share_url: shareUrl };
}
