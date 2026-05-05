import { verifyHmac } from '@/lib/webhooks/handler';
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
