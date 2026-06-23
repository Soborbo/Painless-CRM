import { normalizeEmail } from '@/lib/reviews/engine/logic';
import type { Status } from '@/lib/reviews/engine/types';
import type { SuppressionReason } from '@/lib/reviews/repo/suppression';

// Resend inbound webhook verification + mapping (ADR-047). Resend signs with
// Svix: base64( HMAC-SHA256( base64decode(whsec), `${id}.${timestamp}.${body}` ) ),
// delivered in svix-id / svix-timestamp / svix-signature headers. Neither the v2
// (canonical-header) nor v3 (body-signed, hex) shell matches that scheme, so this
// review-scoped verifier is the sanctioned third pattern. Pure + unit-tested.

export interface SvixHeaders {
  id: string | null;
  timestamp: string | null;
  signature: string | null;
}

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  // Back with a concrete ArrayBuffer so the bytes satisfy SubtleCrypto's
  // BufferSource (ArrayBufferView<ArrayBuffer>) under TS's Uint8Array generic.
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToBase64(buf: ArrayBuffer): string {
  let s = '';
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
  return btoa(s);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Verify a Resend (Svix) webhook signature. `secret` is the `whsec_...` value. */
export async function verifyResendSignature(
  secret: string,
  headers: SvixHeaders,
  rawBody: string,
): Promise<boolean> {
  const { id, timestamp, signature } = headers;
  if (!id || !timestamp || !signature) return false;

  const keyB64 = secret.startsWith('whsec_') ? secret.slice(6) : secret;
  const key = await crypto.subtle.importKey(
    'raw',
    base64ToBytes(keyB64),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${id}.${timestamp}.${rawBody}`),
  );
  const expected = bytesToBase64(mac);

  // svix-signature is a space-separated list of "v1,<base64>" tokens; any match passes.
  for (const token of signature.split(' ')) {
    const comma = token.indexOf(',');
    const provided = comma >= 0 ? token.slice(comma + 1) : token;
    if (timingSafeEqual(provided, expected)) return true;
  }
  return false;
}

export interface SuppressionEffect {
  reason: SuppressionReason;
  close: Extract<Status, 'unsubscribed' | 'complained'>;
}

/** Map a Resend event type to its suppression effect (or null = ignore). */
export function mapResendEvent(type: string): SuppressionEffect | null {
  switch (type) {
    case 'email.bounced':
      return { reason: 'hard_bounce', close: 'unsubscribed' };
    case 'email.complained':
      return { reason: 'spam_complaint', close: 'complained' };
    default:
      return null;
  }
}

/** Pull the recipient address out of a Resend event payload (`data.to`). */
export function recipientOf(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const data = (payload as { data?: unknown }).data;
  if (typeof data !== 'object' || data === null) return null;
  const to = (data as { to?: unknown }).to;
  const addr = Array.isArray(to) ? to[0] : to;
  return typeof addr === 'string' ? normalizeEmail(addr) : null;
}
