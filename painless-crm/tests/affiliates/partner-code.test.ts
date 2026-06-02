import { isValidPartnerCode } from '@/lib/queries/partner-portal';
import { describe, expect, it } from 'vitest';

describe('isValidPartnerCode', () => {
  it('accepts typical affiliate codes', () => {
    expect(isValidPartnerCode('JONNY25')).toBe(true);
    expect(isValidPartnerCode('RELISHHQ')).toBe(true);
    expect(isValidPartnerCode('agent_007')).toBe(true);
    expect(isValidPartnerCode('north-east')).toBe(true);
  });

  it('rejects too-short, too-long, empty or unsafe input', () => {
    expect(isValidPartnerCode('')).toBe(false);
    expect(isValidPartnerCode('ab')).toBe(false);
    expect(isValidPartnerCode('x'.repeat(41))).toBe(false);
    expect(isValidPartnerCode('drop;table')).toBe(false);
    expect(isValidPartnerCode('has space')).toBe(false);
    expect(isValidPartnerCode('../etc')).toBe(false);
  });
});
