import { completeness, nextSortOrder } from '@/lib/jobs/tasks';
import { AddJobTaskSchema, DeleteJobTaskSchema, ToggleJobTaskSchema } from '@/lib/schemas/job-task';
import { describe, expect, it } from 'vitest';

const JOB_ID = '11111111-1111-4111-8111-111111111111';
const TASK_ID = '22222222-2222-4222-8222-222222222222';
const USER_ID = '33333333-3333-4333-8333-333333333333';

describe('completeness', () => {
  it('reports 0% for an empty list', () => {
    expect(completeness([])).toEqual({ total: 0, done: 0, percent: 0 });
  });

  it('counts done vs total and rounds the percent', () => {
    const tasks = [
      { done: true, sort_order: 0 },
      { done: false, sort_order: 1 },
      { done: true, sort_order: 2 },
    ];
    expect(completeness(tasks)).toEqual({ total: 3, done: 2, percent: 67 });
  });

  it('is 100% when all done', () => {
    expect(completeness([{ done: true, sort_order: 0 }]).percent).toBe(100);
  });
});

describe('nextSortOrder', () => {
  it('is 0 for an empty list', () => {
    expect(nextSortOrder([])).toBe(0);
  });

  it('is one past the current max (not the count)', () => {
    expect(
      nextSortOrder([
        { done: false, sort_order: 0 },
        { done: true, sort_order: 5 },
        { done: false, sort_order: 2 },
      ]),
    ).toBe(6);
  });
});

describe('AddJobTaskSchema', () => {
  it('accepts a minimal task', () => {
    const r = AddJobTaskSchema.safeParse({ job_id: JOB_ID, title: 'Pack the kitchen' });
    expect(r.success).toBe(true);
  });

  it('rejects an empty title and trims', () => {
    expect(AddJobTaskSchema.safeParse({ job_id: JOB_ID, title: '   ' }).success).toBe(false);
    const r = AddJobTaskSchema.parse({ job_id: JOB_ID, title: '  tidy  ' });
    expect(r.title).toBe('tidy');
  });

  it('treats empty due_date / assignee as undefined', () => {
    const r = AddJobTaskSchema.parse({
      job_id: JOB_ID,
      title: 'x',
      due_date: '',
      assigned_to_id: '',
    });
    expect(r.due_date).toBeUndefined();
    expect(r.assigned_to_id).toBeUndefined();
  });

  it('validates due_date format and assignee uuid', () => {
    expect(
      AddJobTaskSchema.safeParse({ job_id: JOB_ID, title: 'x', due_date: '12/01/2026' }).success,
    ).toBe(false);
    expect(
      AddJobTaskSchema.safeParse({ job_id: JOB_ID, title: 'x', due_date: '2026-01-12' }).success,
    ).toBe(true);
    expect(
      AddJobTaskSchema.safeParse({ job_id: JOB_ID, title: 'x', assigned_to_id: USER_ID }).success,
    ).toBe(true);
    expect(
      AddJobTaskSchema.safeParse({ job_id: JOB_ID, title: 'x', assigned_to_id: 'nope' }).success,
    ).toBe(false);
  });
});

describe('ToggleJobTaskSchema', () => {
  it('maps checkbox values to a boolean', () => {
    expect(ToggleJobTaskSchema.parse({ id: TASK_ID, job_id: JOB_ID, done: 'on' }).done).toBe(true);
    expect(ToggleJobTaskSchema.parse({ id: TASK_ID, job_id: JOB_ID }).done).toBe(false);
    expect(ToggleJobTaskSchema.parse({ id: TASK_ID, job_id: JOB_ID, done: null }).done).toBe(false);
  });
});

describe('DeleteJobTaskSchema', () => {
  it('requires both uuids', () => {
    expect(DeleteJobTaskSchema.safeParse({ id: TASK_ID, job_id: JOB_ID }).success).toBe(true);
    expect(DeleteJobTaskSchema.safeParse({ id: 'x', job_id: JOB_ID }).success).toBe(false);
  });
});
