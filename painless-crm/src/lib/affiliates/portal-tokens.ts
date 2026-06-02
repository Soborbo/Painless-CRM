// Phase 16 §2 — partner-portal access tokens. HMAC-signed tokens that encode
// (affiliate_id, exp) and live in the portal URL (/partners/p/[token]). Signing
// instead of using the bare referral code closes the leak where anyone who
// knows a customer-facing code could read an affiliate's earnings — only a link
// minted with the server secret resolves. No schema impact (mirrors
// lib/quotes/share-tokens). Long TTL: partner links are durable, re-mintable.

const TOKEN_VERSION = 1;
const DEFAULT_TTL_SECONDS = 365 * 24 * 60 * 60; // 1 year

export interface PartnerTokenPayload {
  v: number;
  a: string; // affiliate id
  exp: number; // unix seconds
}

export type PartnerVerifyResult =
  | { ok: true; affiliateId: string }
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

function importKey(secret: string): Promise<CryptoKey> {
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
  for (let i = 0; i < a.length; i++) mismatch |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return mismatch === 0;
}

export async function signPartnerToken(
  affiliateId: string,
  secret: string,
  opts: { ttlSeconds?: number; now?: Date } = {},
): Promise<string> {
  if (!secret || secret.length < 32) {
    throw new Error('Partner link secret must be at least 32 characters');
  }
  const now = opts.now ?? new Date();
  const exp = Math.floor(now.getTime() / 1000) + (opts.ttlSeconds ?? DEFAULT_TTL_SECONDS);
  const payload: PartnerTokenPayload = { v: TOKEN_VERSION, a: affiliateId, exp };
  const body = base64UrlEncode(enc.encode(JSON.stringify(payload)));
  const key = await importKey(secret);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(body)));
  return `${body}.${base64UrlEncode(sig)}`;
}

export async function verifyPartnerToken(
  token: string,
  secret: string,
  now: Date = new Date(),
): Promise<PartnerVerifyResult> {
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
  if (!timingSafeEqual(sigBytes, expected)) return { ok: false, reason: 'invalid_signature' };

  let parsed: unknown;
  try {
    parsed = JSON.parse(dec.decode(bodyBytes));
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  if (typeof parsed !== 'object' || parsed === null) return { ok: false, reason: 'malformed' };
  const c = parsed as Record<string, unknown>;
  if (c.v !== TOKEN_VERSION) return { ok: false, reason: 'wrong_version' };
  if (typeof c.a !== 'string' || typeof c.exp !== 'number') {
    return { ok: false, reason: 'malformed' };
  }
  if (c.exp * 1000 <= now.getTime()) return { ok: false, reason: 'expired' };
  return { ok: true, affiliateId: c.a };
}
