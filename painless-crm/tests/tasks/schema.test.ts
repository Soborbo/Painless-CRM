import {
  CompleteTaskSchema,
  CreateTaskSchema,
  ReassignTaskSchema,
  dueToIso,
} from '@/lib/schemas/task';
import { describe, expect, it } from 'vitest';

const JOB_ID = '11111111-1111-4111-8111-111111111111';
const USER_A = '22222222-2222-4222-8222-222222222222';
const USER_B = '33333333-3333-4333-8333-333333333333';

describe('CreateTaskSchema', () => {
  it('applies defaults for kind/priority/assignees', () => {
    const r = CreateTaskSchema.parse({ title: 'Chase quote' });
    expect(r.kind).toBe('followup');
    expect(r.priority).toBe('medium');
    expect(r.assigned_to_ids).toEqual([]);
  });

  it('trims and rejects empty titles', () => {
    expect(CreateTaskSchema.safeParse({ title: '   ' }).success).toBe(false);
    expect(CreateTaskSchema.parse({ title: '  tidy  ' }).title).toBe('tidy');
  });

  it('accepts multiple assignees', () => {
    const r = CreateTaskSchema.parse({ title: 'x', assigned_to_ids: [USER_A, USER_B] });
    expect(r.assigned_to_ids).toEqual([USER_A, USER_B]);
  });

  it('requires related_id when related_type is set', () => {
    expect(CreateTaskSchema.safeParse({ title: 'x', related_type: 'job' }).success).toBe(false);
    expect(
      CreateTaskSchema.safeParse({ title: 'x', related_type: 'job', related_id: JOB_ID }).success,
    ).toBe(true);
  });

  it('accepts a date or a datetime due, rejects junk', () => {
    expect(CreateTaskSchema.safeParse({ title: 'x', due_at: '2026-06-16' }).success).toBe(true);
    expect(
      CreateTaskSchema.safeParse({ title: 'x', due_at: '2026-06-16T09:00:00Z' }).success,
    ).toBe(true);
    expect(CreateTaskSchema.safeParse({ title: 'x', due_at: '16/06/2026' }).success).toBe(false);
    expect(CreateTaskSchema.parse({ title: 'x', due_at: '' }).due_at).toBeUndefined();
  });
});

describe('CompleteTaskSchema', () => {
  it('maps checkbox values to a boolean', () => {
    expect(CompleteTaskSchema.parse({ id: JOB_ID, done: 'on' }).done).toBe(true);
    expect(CompleteTaskSchema.parse({ id: JOB_ID }).done).toBe(false);
    expect(CompleteTaskSchema.parse({ id: JOB_ID, done: null }).done).toBe(false);
  });
});

describe('ReassignTaskSchema', () => {
  it('rejects non-uuid assignees', () => {
    expect(ReassignTaskSchema.safeParse({ id: JOB_ID, assigned_to_ids: ['nope'] }).success).toBe(
      false,
    );
    expect(
      ReassignTaskSchema.safeParse({ id: JOB_ID, assigned_to_ids: [USER_A] }).success,
    ).toBe(true);
  });
});

describe('dueToIso', () => {
  it('normalizes a date to UTC midnight and passes datetimes through', () => {
    expect(dueToIso('2026-06-16')).toBe('2026-06-16T00:00:00.000Z');
    expect(dueToIso('2026-06-16T09:30:00.000Z')).toBe('2026-06-16T09:30:00.000Z');
    expect(dueToIso(undefined)).toBeNull();
  });
});
