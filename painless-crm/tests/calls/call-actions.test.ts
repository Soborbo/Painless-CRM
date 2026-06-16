import { CreateJobFromCallSchema, MarkCallReturnedSchema } from '@/lib/schemas/phone-call';
import { annotateRepeatCounts } from '@/lib/queries/calls-inbox';
import { describe, expect, it } from 'vitest';

const UUID = '11111111-1111-1111-1111-111111111111';

describe('MarkCallReturnedSchema', () => {
  it('accepts an id with an optional note, blank note -> null', () => {
    expect(MarkCallReturnedSchema.parse({ phone_call_id: UUID, note: 'rang back, booked survey' })).toEqual({
      phone_call_id: UUID,
      note: 'rang back, booked survey',
    });
    expect(MarkCallReturnedSchema.parse({ phone_call_id: UUID, note: '' }).note).toBeNull();
    expect(MarkCallReturnedSchema.parse({ phone_call_id: UUID }).note).toBeNull();
  });

  it('rejects a non-uuid id', () => {
    expect(MarkCallReturnedSchema.safeParse({ phone_call_id: 'nope' }).success).toBe(false);
  });
});

describe('CreateJobFromCallSchema', () => {
  it('requires a uuid', () => {
    expect(CreateJobFromCallSchema.safeParse({ phone_call_id: UUID }).success).toBe(true);
    expect(CreateJobFromCallSchema.safeParse({ phone_call_id: '' }).success).toBe(false);
  });
});

describe('annotateRepeatCounts', () => {
  it('counts inbound calls per normalised caller across the window', () => {
    const rows = [
      { id: 'a', caller_number: '+447700900123' },
      { id: 'b', caller_number: '07700 900123' },
      { id: 'c', caller_number: '+447700900999' },
      { id: 'd', caller_number: null },
    ];
    const out = annotateRepeatCounts(rows);
    expect(out.find((r) => r.id === 'a')?.repeatCount).toBe(2);
    expect(out.find((r) => r.id === 'b')?.repeatCount).toBe(2);
    expect(out.find((r) => r.id === 'c')?.repeatCount).toBe(1);
    expect(out.find((r) => r.id === 'd')?.repeatCount).toBe(1);
  });
});
