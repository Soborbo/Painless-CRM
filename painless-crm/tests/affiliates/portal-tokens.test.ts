import { signPartnerToken, verifyPartnerToken } from '@/lib/affiliates/portal-tokens';
import { describe, expect, it } from 'vitest';

const SECRET = 'x'.repeat(40);
const AFF = '11111111-1111-1111-1111-111111111111';

describe('partner portal tokens', () => {
  it('round-trips a signed token back to its affiliate id', async () => {
    const token = await signPartnerToken(AFF, SECRET);
    const result = await verifyPartnerToken(token, SECRET);
    expect(result).toEqual({ ok: true, affiliateId: AFF });
  });

  it('rejects a token signed with a different secret', async () => {
    const token = await signPartnerToken(AFF, SECRET);
    const result = await verifyPartnerToken(token, 'y'.repeat(40));
    expect(result).toEqual({ ok: false, reason: 'invalid_signature' });
  });

  it('rejects a tampered body', async () => {
    const token = await signPartnerToken(AFF, SECRET);
    const [, sig] = token.split('.');
    const forgedBody = Buffer.from(JSON.stringify({ v: 1, a: 'attacker', exp: 9999999999 }))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    const result = await verifyPartnerToken(`${forgedBody}.${sig}`, SECRET);
    expect(result.ok).toBe(false);
  });

  it('rejects an expired token', async () => {
    const past = new Date('2020-01-01T00:00:00Z');
    const token = await signPartnerToken(AFF, SECRET, { ttlSeconds: 60, now: past });
    const result = await verifyPartnerToken(token, SECRET, new Date('2020-01-02T00:00:00Z'));
    expect(result).toEqual({ ok: false, reason: 'expired' });
  });

  it('rejects malformed input', async () => {
    expect((await verifyPartnerToken('not-a-token', SECRET)).ok).toBe(false);
    expect((await verifyPartnerToken('', SECRET)).ok).toBe(false);
  });

  it('refuses to sign with a too-short secret', async () => {
    await expect(signPartnerToken(AFF, 'short')).rejects.toThrow();
  });
});
