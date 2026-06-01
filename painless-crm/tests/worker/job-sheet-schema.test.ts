import { JobSheetSchema } from '@/lib/schemas/job-sheet';
import { describe, expect, it } from 'vitest';

const base = {
  job_id: '11111111-1111-1111-1111-111111111111',
  client_event_id: '22222222-2222-2222-2222-222222222222',
  actual_hours: '4.5',
};

describe('JobSheetSchema', () => {
  it('accepts a minimal valid sheet and coerces numbers', () => {
    const r = JobSheetSchema.safeParse({
      ...base,
      actual_cubic_ft: '',
      customer_satisfaction_score: '',
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.actual_hours).toBe(4.5);
      expect(r.data.actual_cubic_ft).toBeNull();
      expect(r.data.customer_satisfaction_score).toBeNull();
    }
  });

  it('rejects a satisfaction score outside 1–5', () => {
    expect(JobSheetSchema.safeParse({ ...base, customer_satisfaction_score: '6' }).success).toBe(
      false,
    );
    expect(JobSheetSchema.safeParse({ ...base, customer_satisfaction_score: '3' }).success).toBe(
      true,
    );
  });

  it('requires actual_hours', () => {
    expect(
      JobSheetSchema.safeParse({ job_id: base.job_id, client_event_id: base.client_event_id })
        .success,
    ).toBe(false);
  });

  it('requires damage details when damage is reported', () => {
    expect(JobSheetSchema.safeParse({ ...base, damage_reported: 'true' }).success).toBe(false);
    expect(
      JobSheetSchema.safeParse({ ...base, damage_reported: 'true', damage_details: 'Scuffed wall' })
        .success,
    ).toBe(true);
  });
});
