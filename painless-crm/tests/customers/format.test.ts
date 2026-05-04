import { customerDisplayName, formatPence } from '@/lib/utils/format';
import { describe, expect, it } from 'vitest';

describe('formatPence', () => {
  it('formats whole pounds', () => {
    expect(formatPence(123400)).toBe('£1,234');
  });
  it('renders dash for null/undefined', () => {
    expect(formatPence(null)).toBe('—');
    expect(formatPence(undefined)).toBe('—');
  });
  it('renders £0 for zero', () => {
    expect(formatPence(0)).toBe('£0');
  });
});

describe('customerDisplayName', () => {
  it('uses company_name for business', () => {
    expect(
      customerDisplayName({
        customer_type: 'business',
        company_name: 'Acme Ltd',
        first_name: 'Jane',
        last_name: 'Doe',
        primary_email: 'x@y.co',
      }),
    ).toBe('Acme Ltd');
  });

  it('falls back to first/last for individual', () => {
    expect(
      customerDisplayName({
        customer_type: 'individual',
        company_name: null,
        first_name: 'Jane',
        last_name: 'Doe',
        primary_email: null,
      }),
    ).toBe('Jane Doe');
  });

  it('falls back to email when no name', () => {
    expect(
      customerDisplayName({
        customer_type: 'individual',
        company_name: null,
        first_name: null,
        last_name: null,
        primary_email: 'x@y.co',
      }),
    ).toBe('x@y.co');
  });

  it('falls back to "Unnamed customer" when nothing', () => {
    expect(
      customerDisplayName({
        customer_type: 'individual',
        company_name: null,
        first_name: null,
        last_name: null,
        primary_email: null,
      }),
    ).toBe('Unnamed customer');
  });
});
