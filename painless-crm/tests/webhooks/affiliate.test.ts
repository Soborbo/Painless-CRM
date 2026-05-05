import { IncomingAffiliateSchema } from '@/lib/webhooks/affiliate';
import { describe, expect, it } from 'vitest';

const PAINLESS_COMPANY_ID = '00000000-0000-0000-0000-000000000001';

const baseValid = {
  event_id: 'evt_aff_abc123',
  source: 'affiliate',
  company_id: PAINLESS_COMPANY_ID,
  affiliate_code: 'ABC-123',
  customer: {
    full_name: 'Sample Customer',
    email: 'aff@example.com',
    phone: '07700 900333',
  },
};

describe('IncomingAffiliateSchema', () => {
  it('accepts the minimal contract', () => {
    expect(() => IncomingAffiliateSchema.parse(baseValid)).not.toThrow();
  });

  it('rejects an empty affiliate_code', () => {
    expect(() => IncomingAffiliateSchema.parse({ ...baseValid, affiliate_code: '   ' })).toThrow();
  });

  it('captures full attribution metadata', () => {
    const parsed = IncomingAffiliateSchema.parse({
      ...baseValid,
      attribution: {
        utm_source: 'partner-newsletter',
        utm_campaign: 'summer-2026',
        gclid: 'GCL-AAA-BBB',
        landing_page: 'https://painlessremovals.com/movers/bristol?ref=ABC-123',
      },
    });
    expect(parsed.attribution?.utm_source).toBe('partner-newsletter');
    expect(parsed.attribution?.gclid).toBe('GCL-AAA-BBB');
    expect(parsed.attribution?.landing_page).toContain('ref=');
  });

  it('rejects attribution gclid when too long', () => {
    expect(() =>
      IncomingAffiliateSchema.parse({
        ...baseValid,
        attribution: { gclid: 'x'.repeat(201) },
      }),
    ).toThrow();
  });

  it('lets the message field be omitted', () => {
    const parsed = IncomingAffiliateSchema.parse(baseValid);
    expect(parsed.message).toBeUndefined();
  });
});
