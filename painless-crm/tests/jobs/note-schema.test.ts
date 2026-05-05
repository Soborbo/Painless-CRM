import { AddJobNoteSchema, SoftDeleteNoteSchema } from '@/lib/schemas/note';
import { describe, expect, it } from 'vitest';

const JOB_ID = '11111111-1111-4111-8111-111111111111';
const NOTE_ID = '22222222-2222-4222-8222-222222222222';

describe('AddJobNoteSchema', () => {
  it('defaults to internal when checkbox is absent', () => {
    const parsed = AddJobNoteSchema.parse({
      job_id: JOB_ID,
      body: 'Customer was lovely',
    });
    expect(parsed.is_customer_visible).toBe(false);
  });

  it('flips to customer-visible when checkbox is "on"', () => {
    const parsed = AddJobNoteSchema.parse({
      job_id: JOB_ID,
      body: 'Visible to customer',
      is_customer_visible: 'on',
    });
    expect(parsed.is_customer_visible).toBe(true);
  });

  it('treats "true"/"false" string forms correctly', () => {
    expect(
      AddJobNoteSchema.parse({ job_id: JOB_ID, body: 'x', is_customer_visible: 'true' })
        .is_customer_visible,
    ).toBe(true);
    expect(
      AddJobNoteSchema.parse({ job_id: JOB_ID, body: 'x', is_customer_visible: 'false' })
        .is_customer_visible,
    ).toBe(false);
  });

  it('rejects an empty body', () => {
    const result = AddJobNoteSchema.safeParse({ job_id: JOB_ID, body: '   ' });
    expect(result.success).toBe(false);
  });

  it('rejects an excessively long body', () => {
    const result = AddJobNoteSchema.safeParse({
      job_id: JOB_ID,
      body: 'a'.repeat(8001),
    });
    expect(result.success).toBe(false);
  });

  it('rejects a non-uuid job id', () => {
    const result = AddJobNoteSchema.safeParse({ job_id: 'nope', body: 'hello' });
    expect(result.success).toBe(false);
  });

  it('trims the body', () => {
    const parsed = AddJobNoteSchema.parse({ job_id: JOB_ID, body: '   trim me   ' });
    expect(parsed.body).toBe('trim me');
  });
});

describe('SoftDeleteNoteSchema', () => {
  it('parses uuid pair', () => {
    expect(SoftDeleteNoteSchema.parse({ id: NOTE_ID, job_id: JOB_ID })).toEqual({
      id: NOTE_ID,
      job_id: JOB_ID,
    });
  });

  it('rejects bad ids', () => {
    expect(SoftDeleteNoteSchema.safeParse({ id: 'x', job_id: JOB_ID }).success).toBe(false);
    expect(SoftDeleteNoteSchema.safeParse({ id: NOTE_ID, job_id: 'y' }).success).toBe(false);
  });
});
