import { CreateBriefItemSchema, DeleteBriefItemSchema } from '@/lib/schemas/job-brief';
import { describe, expect, it } from 'vitest';

const JOB = '00000000-0000-0000-0000-0000000000aa';

describe('CreateBriefItemSchema', () => {
  it('accepts a kit item and defaults quantity to 1', () => {
    const r = CreateBriefItemSchema.safeParse({ job_id: JOB, kind: 'kit', item: 'Mattress bag' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.quantity).toBe(1);
  });

  it('coerces a numeric quantity and trims the item', () => {
    const r = CreateBriefItemSchema.safeParse({
      job_id: JOB,
      kind: 'excluded',
      item: '  Garden shed  ',
      quantity: '3',
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.quantity).toBe(3);
      expect(r.data.item).toBe('Garden shed');
    }
  });

  it('rejects an empty item and an unknown kind', () => {
    expect(CreateBriefItemSchema.safeParse({ job_id: JOB, kind: 'kit', item: '   ' }).success).toBe(
      false,
    );
    expect(CreateBriefItemSchema.safeParse({ job_id: JOB, kind: 'other', item: 'x' }).success).toBe(
      false,
    );
  });

  it('treats a blank notes field as absent', () => {
    const r = CreateBriefItemSchema.safeParse({ job_id: JOB, kind: 'kit', item: 'Box', notes: '' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.notes).toBeUndefined();
  });
});

describe('DeleteBriefItemSchema', () => {
  it('requires a uuid id', () => {
    expect(DeleteBriefItemSchema.safeParse({ id: 'nope' }).success).toBe(false);
    expect(
      DeleteBriefItemSchema.safeParse({ id: '00000000-0000-0000-0000-0000000000bb' }).success,
    ).toBe(true);
  });
});
