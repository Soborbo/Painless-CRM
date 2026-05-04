import { CustomerListFiltersSchema, CustomerSchema } from '@/lib/schemas/customer';
import { describe, expect, it } from 'vitest';

const baseIndividual = {
  customer_type: 'individual' as const,
  first_name: 'Jane',
  last_name: 'Doe',
  primary_email: 'jane@example.com',
  primary_phone: '',
  acquisition_source: 'referral' as const,
  acquisition_campaign: '',
  marketing_consent: true,
  notes: '',
};

const baseBusiness = {
  customer_type: 'business' as const,
  company_name: 'Acme Ltd',
  first_name: '',
  last_name: '',
  vat_number: 'GB123',
  payment_terms_days: 30,
  primary_email: 'hello@acme.co',
  primary_phone: '',
  acquisition_source: undefined,
  acquisition_campaign: '',
  marketing_consent: false,
  notes: '',
};

describe('CustomerSchema', () => {
  it('parses a valid individual', () => {
    const result = CustomerSchema.safeParse(baseIndividual);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.customer_type).toBe('individual');
      expect(result.data.primary_phone).toBeNull();
    }
  });

  it('parses a valid business', () => {
    const result = CustomerSchema.safeParse(baseBusiness);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.customer_type).toBe('business');
      expect(result.data.payment_terms_days).toBe(30);
    }
  });

  it('rejects individual with no email and no phone', () => {
    const result = CustomerSchema.safeParse({
      ...baseIndividual,
      primary_email: '',
      primary_phone: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects business with no company name', () => {
    const result = CustomerSchema.safeParse({ ...baseBusiness, company_name: '' });
    expect(result.success).toBe(false);
  });

  it('rejects individual with missing first_name', () => {
    const result = CustomerSchema.safeParse({ ...baseIndividual, first_name: '' });
    expect(result.success).toBe(false);
  });

  it('rejects malformed email', () => {
    const result = CustomerSchema.safeParse({
      ...baseIndividual,
      primary_email: 'not-an-email',
    });
    expect(result.success).toBe(false);
  });

  it('rejects payment_terms_days out of range', () => {
    const result = CustomerSchema.safeParse({ ...baseBusiness, payment_terms_days: 500 });
    expect(result.success).toBe(false);
  });
});

describe('CustomerListFiltersSchema', () => {
  it('defaults page to 1 and tolerates blank q/type', () => {
    const result = CustomerListFiltersSchema.parse({});
    expect(result.page).toBe(1);
    expect(result.q).toBeUndefined();
    expect(result.type).toBeUndefined();
  });

  it('parses page from string', () => {
    const result = CustomerListFiltersSchema.parse({ page: '3' });
    expect(result.page).toBe(3);
  });

  it('rejects unknown type', () => {
    const result = CustomerListFiltersSchema.safeParse({ type: 'whales' });
    expect(result.success).toBe(false);
  });
});
