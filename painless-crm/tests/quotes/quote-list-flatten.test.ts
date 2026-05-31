import { flattenQuoteListItem } from '@/lib/queries/quotes';
import { describe, expect, it } from 'vitest';

const CUSTOMER = {
  customer_type: 'individual',
  first_name: 'Mary',
  last_name: 'Smith',
  company_name: null,
  primary_email: 'mary@example.com',
};

function raw(jobShape: unknown) {
  return {
    id: 'q1',
    job_id: 'j1',
    status: 'sent',
    total_pence: 145000,
    valid_until: '2026-06-01T00:00:00.000Z',
    sent_at: null,
    declined_at: null,
    withdrawn_at: null,
    revision_number: 2,
    open_count: 0,
    created_at: '2026-05-19T08:00:00.000Z',
    job: jobShape,
  };
}

describe('flattenQuoteListItem', () => {
  it('reads the job + customer when embedded as objects', () => {
    const item = flattenQuoteListItem(
      raw({ job_number: 'J2026-00001', move_date: '2026-06-10T09:00:00.000Z', customer: CUSTOMER }),
    );
    expect(item.job_number).toBe('J2026-00001');
    expect(item.move_date).toBe('2026-06-10T09:00:00.000Z');
    expect(item.customer?.primary_email).toBe('mary@example.com');
    expect(item.revision_number).toBe(2);
  });

  it('normalises the PostgREST one-element-array embed shape', () => {
    const item = flattenQuoteListItem(
      raw([{ job_number: 'J2026-00002', move_date: null, customer: [CUSTOMER] }]),
    );
    expect(item.job_number).toBe('J2026-00002');
    expect(item.customer?.first_name).toBe('Mary');
  });

  it('falls back gracefully when the job or customer is absent', () => {
    const item = flattenQuoteListItem(raw(null));
    expect(item.job_number).toBe('—');
    expect(item.move_date).toBeNull();
    expect(item.customer).toBeNull();
  });

  it('defaults missing counters', () => {
    const base = raw({ job_number: 'J', customer: null }) as Record<string, unknown>;
    base.revision_number = null;
    base.open_count = null;
    base.total_pence = null;
    const item = flattenQuoteListItem(base);
    expect(item.revision_number).toBe(1);
    expect(item.open_count).toBe(0);
    expect(item.total_pence).toBe(0);
  });
});
