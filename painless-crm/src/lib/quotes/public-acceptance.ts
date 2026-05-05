import type { PublicQuote } from '@/lib/queries/public-quote';

// Pure helpers for the public acceptance flow. Kept free of Supabase / next
// imports so they can be unit-tested without bootstrapping a request context.

export type AcceptableStatus =
  | { ok: true }
  | { ok: false; reason: 'already_accepted' | 'declined' | 'expired_status' | 'expired_validity' };

export function classifyAcceptable(quote: PublicQuote, now: Date = new Date()): AcceptableStatus {
  if (quote.status === 'accepted') return { ok: false, reason: 'already_accepted' };
  if (quote.status === 'declined') return { ok: false, reason: 'declined' };
  if (quote.status === 'expired') return { ok: false, reason: 'expired_status' };
  const validUntil = new Date(quote.valid_until).getTime();
  if (Number.isFinite(validUntil) && validUntil <= now.getTime()) {
    return { ok: false, reason: 'expired_validity' };
  }
  return { ok: true };
}

const IP_HEADERS = ['cf-connecting-ip', 'x-real-ip', 'x-forwarded-for'] as const;

export function pickClientIp(headers: Headers): string | null {
  for (const name of IP_HEADERS) {
    const raw = headers.get(name);
    if (!raw) continue;
    const first = raw.split(',')[0]?.trim();
    if (first) return first;
  }
  return null;
}
