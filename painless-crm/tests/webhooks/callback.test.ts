import { IncomingCallbackSchema } from '@/lib/webhooks/callback';
import { describe, expect, it } from 'vitest';

const PAINLESS_COMPANY_ID = '00000000-0000-0000-0000-000000000001';

const baseValid = {
  event_id: 'evt_callback_abc123',
  source: 'website',
  company_id: PAINLESS_COMPANY_ID,
  customer: {
    full_name: 'John Smith',
    email: 'john@example.com',
    phone: '07700 900222',
  },
};

describe('IncomingCallbackSchema', () => {
  it('defaults kind to "callback" when omitted', () => {
    const parsed = IncomingCallbackSchema.parse(baseValid);
    expect(parsed.kind).toBe('callback');
  });

  it('accepts kind="clearance_callback"', () => {
    const parsed = IncomingCallbackSchema.parse({ ...baseValid, kind: 'clearance_callback' });
    expect(parsed.kind).toBe('clearance_callback');
  });

  it('rejects an unknown kind', () => {
    expect(() => IncomingCallbackSchema.parse({ ...baseValid, kind: 'tea_invitation' })).toThrow();
  });

  it('captures preferred_window and property_postcode', () => {
    const parsed = IncomingCallbackSchema.parse({
      ...baseValid,
      preferred_window: 'Weekday mornings',
      property_postcode: 'BS1 4QD',
    });
    expect(parsed.preferred_window).toBe('Weekday mornings');
    expect(parsed.property_postcode).toBe('BS1 4QD');
  });

  it('caps the message length', () => {
    expect(() =>
      IncomingCallbackSchema.parse({ ...baseValid, message: 'x'.repeat(2001) }),
    ).toThrow();
  });
});
