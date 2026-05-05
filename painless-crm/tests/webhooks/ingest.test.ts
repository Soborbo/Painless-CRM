import { IncomingQuoteSchema } from '@/lib/webhooks/quote';
import { describe, expect, it } from 'vitest';

const PAINLESS_COMPANY_ID = '00000000-0000-0000-0000-000000000001';

const valid = {
  event_id: 'evt_calculator_abc123',
  source: 'website',
  company_id: PAINLESS_COMPANY_ID,
  customer: {
    full_name: 'Sample Customer',
    email: 'sample@example.com',
    phone: '07700 900123',
    postcode: 'BS1 4QD',
  },
};

describe('IncomingQuoteSchema', () => {
  it('accepts the minimal contract', () => {
    expect(() => IncomingQuoteSchema.parse(valid)).not.toThrow();
  });

  it('rejects malformed email', () => {
    expect(() =>
      IncomingQuoteSchema.parse({
        ...valid,
        customer: { ...valid.customer, email: 'not-an-email' },
      }),
    ).toThrow();
  });

  it('rejects non-uuid company_id', () => {
    expect(() => IncomingQuoteSchema.parse({ ...valid, company_id: 'painless' })).toThrow();
  });

  it('accepts an optional quote payload', () => {
    const parsed = IncomingQuoteSchema.parse({
      ...valid,
      quote: {
        pricing_version_id: '11111111-1111-4111-8111-111111111111',
        size_code: 'two_bed',
        distance_miles: 18,
        complications: ['narrow_access'],
        total_pence: 65000,
      },
    });
    expect(parsed.quote?.total_pence).toBe(65000);
  });
});
