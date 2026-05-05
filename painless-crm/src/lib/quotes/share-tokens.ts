// Quote share-link tokens.
//
// HMAC-signed short tokens that encode (quote_id, exp, purpose) and live in
// the public acceptance URL. We sign instead of storing a column on `quotes`
// so the URL-token contract has no schema impact (per CLAUDE.md ADR rules
// for spine tables) and no DB lookup is required to detect tampering.
//
// The token is the literal value persisted to `quote_acceptances.acceptance_token`
// once a customer clicks accept — that's the audit trail per Phase 06 spec.

const TOKEN_VERSION = 1;
const DEFAULT_TTL_SECONDS = 14 * 24 * 60 * 60; // 14 days

export type TokenPurpose = 'view' | 'accept';

export interface QuoteTokenPayload {
  v: number;
  q: string; // quote id
  exp: number; // unix seconds
  p: TokenPurpose;
}

export interface SignQuoteTokenArgs {
  quoteId: string;
  purpose?: TokenPurpose;
  ttlSeconds?: number;
  now?: Date;
}

export type VerifyResult =
  | { ok: true; payload: QuoteTokenPayload }
  | { ok: false; reason: 'malformed' | 'invalid_signature' | 'expired' | 'wrong_version' };

const enc = new TextEncoder();
const dec = new TextDecoder();

function base64UrlEncode(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(text: string): Uint8Array | null {
  try {
    const padded = text.replace(/-/g, '+').replace(/_/g, '/');
    const pad = padded.length % 4;
    const fixed = pad ? padded + '='.repeat(4 - pad) : padded;
    const bin = atob(fixed);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  return mismatch === 0;
}

export async function signQuoteToken(args: SignQuoteTokenArgs, secret: string): Promise<string> {
  if (!secret || secret.length < 32) {
    throw new Error('Quote link secret must be at least 32 characters');
  }
  const now = args.now ?? new Date();
  const exp = Math.floor(now.getTime() / 1000) + (args.ttlSeconds ?? DEFAULT_TTL_SECONDS);
  const payload: QuoteTokenPayload = {
    v: TOKEN_VERSION,
    q: args.quoteId,
    exp,
    p: args.purpose ?? 'accept',
  };
  const body = base64UrlEncode(enc.encode(JSON.stringify(payload)));
  const key = await importKey(secret);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(body)));
  return `${body}.${base64UrlEncode(sig)}`;
}

export async function verifyQuoteToken(
  token: string,
  secret: string,
  now: Date = new Date(),
): Promise<VerifyResult> {
  if (!secret) return { ok: false, reason: 'invalid_signature' };
  const parts = token.split('.');
  if (parts.length !== 2) return { ok: false, reason: 'malformed' };
  const [body, sigPart] = parts;
  if (!body || !sigPart) return { ok: false, reason: 'malformed' };

  const sigBytes = base64UrlDecode(sigPart);
  const bodyBytes = base64UrlDecode(body);
  if (!sigBytes || !bodyBytes) return { ok: false, reason: 'malformed' };

  const key = await importKey(secret);
  const expected = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(body)));
  if (!timingSafeEqual(sigBytes, expected)) {
    return { ok: false, reason: 'invalid_signature' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(dec.decode(bodyBytes));
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return { ok: false, reason: 'malformed' };
  }
  const candidate = parsed as Record<string, unknown>;
  if (candidate.v !== TOKEN_VERSION) return { ok: false, reason: 'wrong_version' };
  if (typeof candidate.q !== 'string' || typeof candidate.exp !== 'number') {
    return { ok: false, reason: 'malformed' };
  }
  if (candidate.p !== 'view' && candidate.p !== 'accept') {
    return { ok: false, reason: 'malformed' };
  }
  if (candidate.exp * 1000 <= now.getTime()) {
    return { ok: false, reason: 'expired' };
  }
  return {
    ok: true,
    payload: {
      v: TOKEN_VERSION,
      q: candidate.q,
      exp: candidate.exp,
      p: candidate.p,
    },
  };
}
