import { flattenReviewQueueRow } from '@/lib/queries/profit-review-queue';
import { describe, expect, it } from 'vitest';

const CUSTOMER = {
  customer_type: 'individual',
  first_name: 'Mary',
  last_name: 'Smith',
  company_name: null,
  primary_email: 'mary@example.com',
};

function raw(over: Record<string, unknown> = {}) {
  return {
    id: 'j1',
    job_number: 'J2026-00001',
    stage: 'completed',
    completed_at: '2026-05-20T16:00:00.000Z',
    customer: CUSTOMER,
    assigned_to: { full_name: 'Pete' },
    ...over,
  };
}

describe('flattenReviewQueueRow', () => {
  it('reads customer + assignee embedded as objects', () => {
    const r = flattenReviewQueueRow(raw());
    expect(r.job_number).toBe('J2026-00001');
    expect(r.customer?.first_name).toBe('Mary');
    expect(r.assigned_to_name).toBe('Pete');
  });

  it('normalises the PostgREST one-element-array embed shape', () => {
    const r = flattenReviewQueueRow(
      raw({ customer: [CUSTOMER], assigned_to: [{ full_name: 'Lara' }] }),
    );
    expect(r.customer?.primary_email).toBe('mary@example.com');
    expect(r.assigned_to_name).toBe('Lara');
  });

  it('falls back gracefully when assignee / customer absent', () => {
    const r = flattenReviewQueueRow(raw({ customer: null, assigned_to: null, completed_at: null }));
    expect(r.customer).toBeNull();
    expect(r.assigned_to_name).toBeNull();
    expect(r.completed_at).toBeNull();
  });
});
