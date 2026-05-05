import { createAdminClient } from '@/lib/supabase/admin';

// Quote expiry helpers.
//
// Quotes carry a `valid_until` timestamp from the pricing version's
// `quote_validity_days`. Two paths flip the status to 'expired':
//   1. The cron sweep (`/api/cron/expire-quotes`) — bulk update, runs hourly.
//   2. Lazy expiry on the public acceptance page when a customer opens a
//      stale link — keeps the rendered status honest even between sweeps.
//
// The pure `shouldExpire` is exported for unit tests; the writers are
// thin wrappers around the admin client for the same reason every other
// background mutator (webhooks, snapshots) uses it.

export type ExpireableStatus = 'draft' | 'sent' | 'accepted' | 'declined' | 'expired';

export function shouldExpire(
  status: ExpireableStatus | null | undefined,
  validUntil: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (status !== 'draft' && status !== 'sent') return false;
  if (!validUntil) return false;
  const due = new Date(validUntil).getTime();
  if (!Number.isFinite(due)) return false;
  return due <= now.getTime();
}

export interface ExpireSweepResult {
  expired_count: number;
}

export async function expireOverdueQuotes(now: Date = new Date()): Promise<ExpireSweepResult> {
  const supabase = createAdminClient();
  const cutoff = now.toISOString();
  const { data, error } = await supabase
    .from('quotes')
    .update({ status: 'expired' })
    .in('status', ['draft', 'sent'])
    .lte('valid_until', cutoff)
    .is('deleted_at', null)
    .select('id');
  if (error) throw new Error(`expire sweep failed: ${error.message}`);
  return { expired_count: (data ?? []).length };
}

export async function expireSingleQuote(quoteId: string, now: Date = new Date()): Promise<boolean> {
  const supabase = createAdminClient();
  const cutoff = now.toISOString();
  const { data } = await supabase
    .from('quotes')
    .update({ status: 'expired' })
    .eq('id', quoteId)
    .in('status', ['draft', 'sent'])
    .lte('valid_until', cutoff)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle();
  return Boolean(data);
}
