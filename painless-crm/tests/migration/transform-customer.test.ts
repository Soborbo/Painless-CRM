import {
  type CustomerTransformResult,
  groupByDedupKey,
  transformCustomer,
} from '@/lib/migration/transform-customer';
import { describe, expect, it } from 'vitest';

describe('transformCustomer', () => {
  it('transforms an individual customer', () => {
    const result = transformCustomer({
      customerName: 'Jane Doe',
      email: '  Jane@Example.com ',
      phone: '0117 911 5000',
      notes: 'Prefers morning calls',
      createdDate: '2024-03-01',
    });
    expect(result).toMatchObject({
      customer_type: 'individual',
      first_name: 'Jane',
      last_name: 'Doe',
      company_name: null,
      primary_email: 'jane@example.com',
      primary_phone: '+441179115000',
      notes: 'Prefers morning calls',
      created_at: '2024-03-01',
      dedup_key: 'email:jane@example.com',
      needs_manual_review: false,
    });
  });

  it('keeps company_name only for business customers', () => {
    const business = transformCustomer({
      customerName: 'John Smith',
      companyName: 'Acme Ltd',
      email: 'accounts@acme.test',
    });
    expect(business.customer_type).toBe('business');
    expect(business.company_name).toBe('Acme Ltd');

    const individual = transformCustomer({ customerName: 'John Smith', companyName: 'Acme Ltd' });
    // companyName forces business classification, so company_name is retained here too.
    expect(individual.customer_type).toBe('business');
  });

  it('drops a stray company_name on an individual', () => {
    const result = transformCustomer({ customerName: 'Solo Person', customerType: 'B2C' });
    expect(result.customer_type).toBe('individual');
    expect(result.company_name).toBeNull();
  });

  it('flags rows with no email and no phone for manual review', () => {
    const result = transformCustomer({ customerName: 'No Contact' });
    expect(result.dedup_key).toBeNull();
    expect(result.needs_manual_review).toBe(true);
  });
});

describe('groupByDedupKey', () => {
  const make = (over: Partial<CustomerTransformResult>): CustomerTransformResult => ({
    customer_type: 'individual',
    first_name: 'A',
    last_name: 'B',
    company_name: null,
    primary_email: null,
    primary_phone: null,
    notes: null,
    created_at: null,
    dedup_key: null,
    needs_manual_review: true,
    ...over,
  });

  it('merges rows sharing a dedup key', () => {
    const groups = groupByDedupKey([
      make({ dedup_key: 'email:jane@example.com', needs_manual_review: false }),
      make({ dedup_key: 'email:jane@example.com', needs_manual_review: false, notes: 'second' }),
    ]);
    expect(groups.size).toBe(1);
    expect(groups.get('email:jane@example.com')).toHaveLength(2);
  });

  it('never merges manual-review rows together', () => {
    const groups = groupByDedupKey([make({}), make({}), make({})]);
    expect(groups.size).toBe(3);
    for (const list of groups.values()) expect(list).toHaveLength(1);
  });
});
