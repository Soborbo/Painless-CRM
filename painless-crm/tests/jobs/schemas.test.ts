import {
  CreateJobSchema,
  JobListFiltersSchema,
  JobTagSchema,
  TransitionJobSchema,
} from '@/lib/schemas/job';
import { describe, expect, it } from 'vitest';

describe('CreateJobSchema', () => {
  it('accepts a minimal valid input', () => {
    const result = CreateJobSchema.safeParse({
      customer_id: '11111111-1111-1111-1111-111111111111',
      acquisition_source: 'phone',
      move_date: '',
      notes: '',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.move_date).toBeNull();
  });

  it('rejects unknown acquisition source', () => {
    const result = CreateJobSchema.safeParse({
      customer_id: '11111111-1111-1111-1111-111111111111',
      acquisition_source: 'pigeon',
      move_date: '',
      notes: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects bad move_date', () => {
    const result = CreateJobSchema.safeParse({
      customer_id: '11111111-1111-1111-1111-111111111111',
      acquisition_source: 'phone',
      move_date: 'banana',
      notes: '',
    });
    expect(result.success).toBe(false);
  });
});

describe('TransitionJobSchema', () => {
  const base = {
    id: '11111111-1111-1111-1111-111111111111',
    version: 1,
    target_stage: 'contacted',
    reason: '',
  };

  it('accepts a forward transition with no extra fields', () => {
    const result = TransitionJobSchema.safeParse(base);
    expect(result.success).toBe(true);
  });

  it('requires decline_reason for declined target', () => {
    const result = TransitionJobSchema.safeParse({ ...base, target_stage: 'declined' });
    expect(result.success).toBe(false);
  });

  it('accepts declined with decline_reason', () => {
    const result = TransitionJobSchema.safeParse({
      ...base,
      target_stage: 'declined',
      decline_reason: 'too_expensive',
    });
    expect(result.success).toBe(true);
  });

  it('requires cancellation_reason and deposit_refund_decision for cancelled', () => {
    const justReason = TransitionJobSchema.safeParse({
      ...base,
      target_stage: 'cancelled',
      cancellation_reason: 'Customer changed mind',
    });
    expect(justReason.success).toBe(false);
    const both = TransitionJobSchema.safeParse({
      ...base,
      target_stage: 'cancelled',
      cancellation_reason: 'Customer changed mind',
      deposit_refund_decision: 'refund_full',
    });
    expect(both.success).toBe(true);
  });
});

describe('JobTagSchema', () => {
  it('accepts a clean tag', () => {
    const result = JobTagSchema.safeParse({
      job_id: '11111111-1111-1111-1111-111111111111',
      tag: 'VIP',
    });
    expect(result.success).toBe(true);
  });

  it('rejects tags with weird characters', () => {
    const result = JobTagSchema.safeParse({
      job_id: '11111111-1111-1111-1111-111111111111',
      tag: 'evil; drop table jobs',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty tag', () => {
    const result = JobTagSchema.safeParse({
      job_id: '11111111-1111-1111-1111-111111111111',
      tag: '',
    });
    expect(result.success).toBe(false);
  });
});

describe('JobListFiltersSchema', () => {
  it('defaults page to 1', () => {
    const result = JobListFiltersSchema.parse({});
    expect(result.page).toBe(1);
  });

  it('rejects unknown stage', () => {
    expect(JobListFiltersSchema.safeParse({ stage: 'banana' }).success).toBe(false);
  });

  it('parses page from string', () => {
    expect(JobListFiltersSchema.parse({ page: '7' }).page).toBe(7);
  });
});
