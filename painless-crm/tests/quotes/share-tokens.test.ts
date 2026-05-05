import { signQuoteToken, verifyQuoteToken } from '@/lib/quotes/share-tokens';
import { describe, expect, it } from 'vitest';

const SECRET = 'a'.repeat(48);
const QUOTE_ID = '11111111-1111-4111-8111-111111111111';

describe('signQuoteToken / verifyQuoteToken', () => {
  it('round-trips quote id, purpose, and expiry', async () => {
    const now = new Date('2026-05-04T10:00:00Z');
    const token = await signQuoteToken(
      { quoteId: QUOTE_ID, purpose: 'accept', ttlSeconds: 3600, now },
      SECRET,
    );
    const verified = await verifyQuoteToken(token, SECRET, now);
    expect(verified.ok).toBe(true);
    if (verified.ok) {
      expect(verified.payload.q).toBe(QUOTE_ID);
      expect(verified.payload.p).toBe('accept');
      expect(verified.payload.exp).toBe(Math.floor(now.getTime() / 1000) + 3600);
    }
  });

  it('rejects tampered payload', async () => {
    const now = new Date('2026-05-04T10:00:00Z');
    const token = await signQuoteToken({ quoteId: QUOTE_ID, now }, SECRET);
    const [body, sig] = token.split('.');
    const tampered = `${body}AAA.${sig}`;
    const verified = await verifyQuoteToken(tampered, SECRET, now);
    expect(verified).toEqual({ ok: false, reason: 'invalid_signature' });
  });

  it('rejects malformed tokens', async () => {
    const now = new Date('2026-05-04T10:00:00Z');
    const verified = await verifyQuoteToken('not-a-token', SECRET, now);
    expect(verified).toEqual({ ok: false, reason: 'malformed' });
  });

  it('rejects mismatched secret', async () => {
    const now = new Date('2026-05-04T10:00:00Z');
    const token = await signQuoteToken({ quoteId: QUOTE_ID, now }, SECRET);
    const verified = await verifyQuoteToken(token, 'b'.repeat(48), now);
    expect(verified).toEqual({ ok: false, reason: 'invalid_signature' });
  });

  it('rejects expired tokens', async () => {
    const issued = new Date('2026-05-04T10:00:00Z');
    const token = await signQuoteToken({ quoteId: QUOTE_ID, ttlSeconds: 60, now: issued }, SECRET);
    const later = new Date('2026-05-04T10:02:00Z');
    const verified = await verifyQuoteToken(token, SECRET, later);
    expect(verified).toEqual({ ok: false, reason: 'expired' });
  });

  it('rejects too-short secrets at sign time', async () => {
    await expect(signQuoteToken({ quoteId: QUOTE_ID }, 'short')).rejects.toThrow();
  });
});
