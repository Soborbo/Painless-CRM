import {
  canonicalSignaturePayload,
  isFreshTimestamp,
  isSupportedWebhookVersion,
  verifyHmac,
} from '@/lib/webhooks/handler';
import { describe, expect, it } from 'vitest';

const SECRET = 'super-secret-key-of-sufficient-length-for-tests';
const BODY = JSON.stringify({ event_id: 'evt_1', payload: { ok: true } });

async function hmacHex(secret: string, body: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(body));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

describe('verifyHmac', () => {
  it('accepts a correctly signed body', async () => {
    const sig = await hmacHex(SECRET, BODY);
    expect(await verifyHmac(SECRET, BODY, sig)).toBe(true);
  });

  it('accepts the sha256= prefix form', async () => {
    const sig = `sha256=${await hmacHex(SECRET, BODY)}`;
    expect(await verifyHmac(SECRET, BODY, sig)).toBe(true);
  });

  it('rejects a tampered body', async () => {
    const sig = await hmacHex(SECRET, BODY);
    expect(await verifyHmac(SECRET, `${BODY} `, sig)).toBe(false);
  });

  it('rejects a missing header', async () => {
    expect(await verifyHmac(SECRET, BODY, null)).toBe(false);
  });

  it('rejects a wrong-secret signature', async () => {
    const sig = await hmacHex('different-secret', BODY);
    expect(await verifyHmac(SECRET, BODY, sig)).toBe(false);
  });
});

// Audit H2 — SECURITY_MODEL §4 replay/version gates.
describe('isFreshTimestamp', () => {
  const NOW = 1_700_000_000_000; // ms
  const NOW_S = 1_700_000_000; // s

  it('accepts a timestamp within the 5-minute window', () => {
    expect(isFreshTimestamp(String(NOW_S), NOW)).toBe(true);
    expect(isFreshTimestamp(String(NOW_S - 299), NOW)).toBe(true);
    expect(isFreshTimestamp(String(NOW_S + 299), NOW)).toBe(true);
  });

  it('rejects a stale or far-future timestamp', () => {
    expect(isFreshTimestamp(String(NOW_S - 301), NOW)).toBe(false);
    expect(isFreshTimestamp(String(NOW_S + 301), NOW)).toBe(false);
  });

  it('rejects a missing or non-numeric timestamp', () => {
    expect(isFreshTimestamp(null, NOW)).toBe(false);
    expect(isFreshTimestamp('not-a-number', NOW)).toBe(false);
  });
});

describe('isSupportedWebhookVersion', () => {
  it('accepts a pinned version and rejects anything else', () => {
    expect(isSupportedWebhookVersion('1')).toBe(true);
    expect(isSupportedWebhookVersion('1.0')).toBe(true);
    expect(isSupportedWebhookVersion('2')).toBe(false);
    expect(isSupportedWebhookVersion(null)).toBe(false);
  });
});

describe('canonicalSignaturePayload', () => {
  it('binds timestamp + version + body in order', () => {
    expect(canonicalSignaturePayload('1700000000', '1', '{"a":1}')).toBe('1700000000.1.{"a":1}');
  });
});
