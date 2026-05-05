import { IncomingPartnerRegisterSchema, PARTNER_TYPES } from '@/lib/webhooks/partner-register';
import { describe, expect, it } from 'vitest';

const PAINLESS_COMPANY_ID = '00000000-0000-0000-0000-000000000001';

const valid = {
  event_id: 'evt_pr_abc123',
  source: 'partner_form',
  company_id: PAINLESS_COMPANY_ID,
  partner: {
    name: 'Bristol Estate Agents Ltd',
    contact_name: 'Jane Partner',
    contact_email: 'jane@bristol-agents.example',
    contact_phone: '0117 555 0123',
  },
};

describe('IncomingPartnerRegisterSchema', () => {
  it('accepts the minimal contract and defaults type to B2B_partner', () => {
    const parsed = IncomingPartnerRegisterSchema.parse(valid);
    expect(parsed.partner.type).toBe('B2B_partner');
  });

  it('accepts every defined partner type', () => {
    for (const type of PARTNER_TYPES) {
      const parsed = IncomingPartnerRegisterSchema.parse({
        ...valid,
        partner: { ...valid.partner, type },
      });
      expect(parsed.partner.type).toBe(type);
    }
  });

  it('rejects an unknown partner type', () => {
    expect(() =>
      IncomingPartnerRegisterSchema.parse({
        ...valid,
        partner: { ...valid.partner, type: 'unknown' },
      }),
    ).toThrow();
  });

  it('rejects malformed website URLs', () => {
    expect(() =>
      IncomingPartnerRegisterSchema.parse({
        ...valid,
        partner: { ...valid.partner, website: 'not-a-url' },
      }),
    ).toThrow();
  });

  it('captures proposed_commission with currency default', () => {
    const parsed = IncomingPartnerRegisterSchema.parse({
      ...valid,
      proposed_commission: { type: 'percent_revenue', value: 10 },
    });
    expect(parsed.proposed_commission?.type).toBe('percent_revenue');
    expect(parsed.proposed_commission?.currency).toBe('GBP');
    expect(parsed.proposed_commission?.value).toBe(10);
  });

  it('rejects commission types outside the allowed set', () => {
    expect(() =>
      IncomingPartnerRegisterSchema.parse({
        ...valid,
        proposed_commission: { type: 'random' },
      }),
    ).toThrow();
  });
});
