import { createAdminClient } from '@/lib/supabase/admin';

// Engagement tracking for the public-share link. The acceptance page calls
// `recordQuoteOpen` after the token verifies and the quote is loaded; we
// only update timestamps for quotes that are still actively offered (sent /
// draft) so terminal-state rows aren't churned by stale links and link
// previewers (Slack unfurl, Resend open-tracking pixels). A short throttle
// window collapses page refreshes into a single counted open.

export type QuoteOpenStatus = 'draft' | 'sent' | 'accepted' | 'declined' | 'expired' | null;

const THROTTLE_MS = 60 * 1000;

export interface QuoteOpenSnapshot {
  status: QuoteOpenStatus;
  last_opened_at: string | null;
  first_opened_at: string | null;
}

export interface QuoteOpenDecision {
  record: boolean;
  reason:
    | 'terminal_status'
    | 'no_status'
    | 'throttled'
    | 'first_open'
    | 'subsequent_open'
    | 'invalid_timestamp';
}

export function decideQuoteOpen(
  snap: QuoteOpenSnapshot,
  now: Date = new Date(),
): QuoteOpenDecision {
  if (snap.status == null) return { record: false, reason: 'no_status' };
  if (snap.status === 'accepted' || snap.status === 'declined' || snap.status === 'expired') {
    return { record: false, reason: 'terminal_status' };
  }
  if (snap.first_opened_at === null) return { record: true, reason: 'first_open' };
  const last = snap.last_opened_at ?? snap.first_opened_at;
  const lastMs = new Date(last).getTime();
  if (!Number.isFinite(lastMs)) return { record: false, reason: 'invalid_timestamp' };
  if (now.getTime() - lastMs < THROTTLE_MS) return { record: false, reason: 'throttled' };
  return { record: true, reason: 'subsequent_open' };
}

export interface RecordOpenResult {
  recorded: boolean;
  reason: QuoteOpenDecision['reason'] | 'not_found';
}

export async function recordQuoteOpen(quoteId: string): Promise<RecordOpenResult> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('quotes')
    .select('id, status, first_opened_at, last_opened_at, open_count')
    .eq('id', quoteId)
    .is('deleted_at', null)
    .maybeSingle();
  if (!data) return { recorded: false, reason: 'not_found' };

  const decision = decideQuoteOpen({
    status: data.status as QuoteOpenStatus,
    first_opened_at: (data.first_opened_at as string | null) ?? null,
    last_opened_at: (data.last_opened_at as string | null) ?? null,
  });
  if (!decision.record) return { recorded: false, reason: decision.reason };

  const nowIso = new Date().toISOString();
  const update: Record<string, unknown> = {
    last_opened_at: nowIso,
    open_count: ((data.open_count as number | null) ?? 0) + 1,
  };
  if (data.first_opened_at == null) update.first_opened_at = nowIso;

  await supabase.from('quotes').update(update).eq('id', quoteId);
  return { recorded: true, reason: decision.reason };
}
