import { IncomingContactSchema } from '@/lib/webhooks/contact';
import { describe, expect, it } from 'vitest';

const PAINLESS_COMPANY_ID = '00000000-0000-0000-0000-000000000001';

const valid = {
  event_id: 'evt_contact_abc123',
  source: 'website',
  company_id: PAINLESS_COMPANY_ID,
  customer: {
    full_name: 'Jane Doe',
    email: 'jane@example.com',
    phone: '07700 900111',
  },
};

describe('IncomingContactSchema', () => {
  it('accepts the minimal contract without postcode or message', () => {
    const parsed = IncomingContactSchema.parse(valid);
    expect(parsed.customer.email).toBe('jane@example.com');
    expect(parsed.message).toBeUndefined();
  });

  it('captures a free-text message', () => {
    const parsed = IncomingContactSchema.parse({
      ...valid,
      message: 'Need a quote for next month, prefer Tuesdays',
    });
    expect(parsed.message).toContain('Tuesdays');
  });

  it('captures preferred_contact channel when provided', () => {
    const parsed = IncomingContactSchema.parse({ ...valid, preferred_contact: 'whatsapp' });
    expect(parsed.preferred_contact).toBe('whatsapp');
  });

  it('rejects an unknown preferred_contact value', () => {
    expect(() => IncomingContactSchema.parse({ ...valid, preferred_contact: 'pigeon' })).toThrow();
  });

  it('rejects a malformed phone number', () => {
    expect(() =>
      IncomingContactSchema.parse({
        ...valid,
        customer: { ...valid.customer, phone: 'call-me' },
      }),
    ).toThrow();
  });
});
