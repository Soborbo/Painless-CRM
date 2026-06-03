import { flattenCallbackRow, isCallbackOverdue } from '@/lib/queries/callbacks';
import { CallbackCompletionSchema } from '@/lib/schemas/phone-call';
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
    id: 'c1',
    next_action_due_at: '2026-05-31T14:00:00.000Z',
    next_action: 'call back with survey slot',
    outcome: 'callback_requested',
    direction: 'outbound',
    occurred_at: '2026-05-30T09:00:00.000Z',
    job_id: 'j1',
    job: { job_number: 'J2026-00001' },
    customer: CUSTOMER,
    ...over,
  };
}

describe('flattenCallbackRow', () => {
  it('reads job + customer embedded as objects', () => {
    const r = flattenCallbackRow(raw());
    expect(r.job_number).toBe('J2026-00001');
    expect(r.customer?.first_name).toBe('Mary');
    expect(r.outcome).toBe('callback_requested');
  });

  it('normalises the PostgREST one-element-array embed shape', () => {
    const r = flattenCallbackRow(
      raw({ job: [{ job_number: 'J2026-00002' }], customer: [CUSTOMER] }),
    );
    expect(r.job_number).toBe('J2026-00002');
    expect(r.customer?.primary_email).toBe('mary@example.com');
  });

  it('falls back gracefully when job / customer are absent', () => {
    const r = flattenCallbackRow(raw({ job: null, customer: null, job_id: null }));
    expect(r.job_number).toBeNull();
    expect(r.job_id).toBeNull();
    expect(r.customer).toBeNull();
  });

  it('defaults direction when missing', () => {
    const r = flattenCallbackRow(raw({ direction: null }));
    expect(r.direction).toBe('outbound');
  });
});

describe('isCallbackOverdue', () => {
  // The day boundary is computed in UTC (matches todayWindow and the CF Workers
  // runtime), so the fixtures are UTC-explicit rather than runtime-local.
  const now = new Date('2026-05-31T12:00:00.000Z'); // 31 May, noon UTC

  it('flags a follow-up due on an earlier day as overdue', () => {
    expect(isCallbackOverdue('2026-05-29T10:00:00.000Z', now)).toBe(true);
    expect(isCallbackOverdue('2026-05-30T23:00:00.000Z', now)).toBe(true);
  });

  it('does not flag a follow-up still due today', () => {
    expect(isCallbackOverdue('2026-05-31T00:00:00.000Z', now)).toBe(false);
    expect(isCallbackOverdue('2026-05-31T18:00:00.000Z', now)).toBe(false);
  });
});

describe('CallbackCompletionSchema', () => {
  it('accepts a uuid phone_call_id', () => {
    const out = CallbackCompletionSchema.safeParse({
      phone_call_id: '00000000-0000-0000-0000-000000000001',
    });
    expect(out.success).toBe(true);
  });

  it('rejects a non-uuid id', () => {
    expect(CallbackCompletionSchema.safeParse({ phone_call_id: 'nope' }).success).toBe(false);
    expect(CallbackCompletionSchema.safeParse({}).success).toBe(false);
  });
});
