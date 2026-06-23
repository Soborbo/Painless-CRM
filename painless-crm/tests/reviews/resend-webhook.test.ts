import { mapResendEvent, recipientOf, verifyResendSignature } from '@/lib/reviews/resend-webhook';
import { describe, expect, it } from 'vitest';

// Svix's own documented test vector — proves the HMAC/base64 scheme is correct
// without a live Resend call.
const SVIX = {
  secret: 'whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw',
  id: 'msg_p5jXN8AQM9LWM0D4loKWxJek',
  timestamp: '1614265330',
  body: '{"test": 2432232314}',
  signature: 'v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE=',
};

describe('verifyResendSignature (Svix scheme)', () => {
  it('accepts a valid signature (documented Svix vector)', async () => {
    const ok = await verifyResendSignature(
      SVIX.secret,
      { id: SVIX.id, timestamp: SVIX.timestamp, signature: SVIX.signature },
      SVIX.body,
    );
    expect(ok).toBe(true);
  });

  it('rejects a tampered body', async () => {
    const ok = await verifyResendSignature(
      SVIX.secret,
      { id: SVIX.id, timestamp: SVIX.timestamp, signature: SVIX.signature },
      '{"test": 9999999999}',
    );
    expect(ok).toBe(false);
  });

  it('rejects when headers are missing', async () => {
    const ok = await verifyResendSignature(
      SVIX.secret,
      { id: null, timestamp: SVIX.timestamp, signature: SVIX.signature },
      SVIX.body,
    );
    expect(ok).toBe(false);
  });

  it('accepts when the matching token is one of several', async () => {
    const ok = await verifyResendSignature(
      SVIX.secret,
      { id: SVIX.id, timestamp: SVIX.timestamp, signature: `v1,bogus ${SVIX.signature}` },
      SVIX.body,
    );
    expect(ok).toBe(true);
  });
});

describe('mapResendEvent', () => {
  it('maps bounces and complaints to suppression effects', () => {
    expect(mapResendEvent('email.bounced')).toEqual({
      reason: 'hard_bounce',
      close: 'unsubscribed',
    });
    expect(mapResendEvent('email.complained')).toEqual({
      reason: 'spam_complaint',
      close: 'complained',
    });
  });
  it('ignores delivery/open/click events', () => {
    expect(mapResendEvent('email.delivered')).toBeNull();
    expect(mapResendEvent('email.opened')).toBeNull();
  });
});

describe('recipientOf', () => {
  it('reads data.to (array or string), normalized', () => {
    expect(recipientOf({ data: { to: ['  Jane@Example.COM '] } })).toBe('jane@example.com');
    expect(recipientOf({ data: { to: 'bob@example.com' } })).toBe('bob@example.com');
  });
  it('returns null when absent', () => {
    expect(recipientOf({})).toBeNull();
    expect(recipientOf(null)).toBeNull();
  });
});
