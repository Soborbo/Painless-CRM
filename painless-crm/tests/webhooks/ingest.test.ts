import { IncomingQuoteSchema, mapHeardAboutToSource, mapServiceType } from '@/lib/webhooks/quote';
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

  it('accepts the full rich intake payload', () => {
    const parsed = IncomingQuoteSchema.parse({
      ...valid,
      addresses: {
        from: { formatted: '1 High St, Bristol BS1 4QD', postcode: 'BS1 4QD', floor: 2, has_lift: false },
        to: { formatted: '9 Park Rd, Bath BA1 1AA', postcode: 'BA1 1AA', floor: 0 },
      },
      move: { date: '2026-07-01', flexibility: 'flexible' },
      service: { type: 'home', property_size: 'two_bed', slider_position: 'average' },
      resources: { men: 3, vans: 1, cubic_ft: 650, service_duration_hours: 6 },
      flags: { property_chain: true, key_wait_waiver: false },
      consent: { gdpr: true, marketing: false },
      breakdown: { labour: 30000, mileage: 5000, packing: 12000 },
      extras: { packingTier: 'fullService', disassemblyItems: [{ category: 'bed', quantity: 2 }] },
      attribution: { utm_source: 'google', gclid: 'abc123', session_id: 's-1' },
    });
    expect(parsed.addresses?.from.floor).toBe(2);
    expect(parsed.resources?.cubic_ft).toBe(650);
    expect(parsed.breakdown?.labour).toBe(30000);
    expect((parsed.extras?.disassemblyItems as unknown[]).length).toBe(1);
  });

  it('keeps a sparse session valid (all rich blocks omitted)', () => {
    const parsed = IncomingQuoteSchema.parse(valid);
    expect(parsed.move).toBeUndefined();
    expect(parsed.extras).toBeUndefined();
  });

  it('rejects an out-of-range floor', () => {
    expect(() =>
      IncomingQuoteSchema.parse({
        ...valid,
        addresses: {
          from: { postcode: 'BS1 4QD', floor: 999 },
          to: { postcode: 'BA1 1AA' },
        },
      }),
    ).toThrow();
  });
});

describe('mapServiceType', () => {
  it('maps clearance to waste_clearance', () => {
    expect(mapServiceType('clearance')).toBe('waste_clearance');
  });
  it('maps home and office to removal', () => {
    expect(mapServiceType('home')).toBe('removal');
    expect(mapServiceType('office')).toBe('removal');
  });
  it('returns undefined for an unknown/absent type', () => {
    expect(mapServiceType(undefined)).toBeUndefined();
  });
});

describe('mapHeardAboutToSource', () => {
  it('maps referral-style answers to referral', () => {
    expect(mapHeardAboutToSource('friend')).toBe('referral');
    expect(mapHeardAboutToSource('estate_agent')).toBe('referral');
    expect(mapHeardAboutToSource('returning')).toBe('referral');
  });
  it('leaves ambiguous channels unmapped (so paid buckets stay clean)', () => {
    expect(mapHeardAboutToSource('google')).toBeUndefined();
    expect(mapHeardAboutToSource('social')).toBeUndefined();
    expect(mapHeardAboutToSource('van')).toBeUndefined();
    expect(mapHeardAboutToSource(undefined)).toBeUndefined();
  });

  it('accepts heard_about in the rich payload', () => {
    const parsed = IncomingQuoteSchema.parse({
      ...valid,
      attribution: { heard_about: 'friend', utm_source: 'google' },
    });
    expect(parsed.attribution?.heard_about).toBe('friend');
  });
});
