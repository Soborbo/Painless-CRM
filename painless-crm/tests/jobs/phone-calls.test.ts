import { shouldRecordFirstResponse } from '@/lib/jobs/sla-touch';
import { LogPhoneCallSchema } from '@/lib/schemas/phone-call';
import { describe, expect, it } from 'vitest';

const JOB_ID = '11111111-1111-4111-8111-111111111111';
const NOW_ISO = '2026-05-04T10:00:00Z';

describe('LogPhoneCallSchema', () => {
  it('parses a minimal valid form payload', () => {
    const parsed = LogPhoneCallSchema.parse({
      job_id: JOB_ID,
      direction: 'inbound',
      occurred_at: NOW_ISO,
      duration_seconds: '120',
    });
    expect(parsed.duration_seconds).toBe(120);
    expect(parsed.notes).toBeNull();
    expect(parsed.caller_number).toBeNull();
  });

  it('coerces empty optional strings to null', () => {
    const parsed = LogPhoneCallSchema.parse({
      job_id: JOB_ID,
      direction: 'outbound',
      occurred_at: NOW_ISO,
      duration_seconds: '0',
      caller_number: '   ',
      called_number: '',
      outcome: '',
      next_action: '',
      next_action_due_at: '',
      notes: '',
    });
    expect(parsed.caller_number).toBeNull();
    expect(parsed.called_number).toBeNull();
    expect(parsed.outcome).toBeNull();
    expect(parsed.next_action).toBeNull();
    expect(parsed.next_action_due_at).toBeNull();
    expect(parsed.notes).toBeNull();
  });

  it('accepts a valid outcome and a follow-up with a due date', () => {
    const parsed = LogPhoneCallSchema.parse({
      job_id: JOB_ID,
      direction: 'outbound',
      occurred_at: NOW_ISO,
      duration_seconds: '90',
      outcome: 'callback_requested',
      next_action: 'Call back with a survey slot',
      next_action_due_at: '2026-05-06T09:00:00Z',
    });
    expect(parsed.outcome).toBe('callback_requested');
    expect(parsed.next_action).toBe('Call back with a survey slot');
    expect(parsed.next_action_due_at).toBe('2026-05-06T09:00:00Z');
  });

  it('rejects an unknown outcome', () => {
    const result = LogPhoneCallSchema.safeParse({
      job_id: JOB_ID,
      direction: 'inbound',
      occurred_at: NOW_ISO,
      duration_seconds: '5',
      outcome: 'sold_them_a_boat',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a malformed follow-up due date', () => {
    const result = LogPhoneCallSchema.safeParse({
      job_id: JOB_ID,
      direction: 'inbound',
      occurred_at: NOW_ISO,
      duration_seconds: '5',
      next_action_due_at: 'whenever',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid timestamps', () => {
    const result = LogPhoneCallSchema.safeParse({
      job_id: JOB_ID,
      direction: 'inbound',
      occurred_at: 'not-a-date',
      duration_seconds: '5',
    });
    expect(result.success).toBe(false);
  });

  it('rejects unknown directions', () => {
    const result = LogPhoneCallSchema.safeParse({
      job_id: JOB_ID,
      direction: 'sideways',
      occurred_at: NOW_ISO,
      duration_seconds: '5',
    });
    expect(result.success).toBe(false);
  });

  it('rejects ridiculous durations', () => {
    const result = LogPhoneCallSchema.safeParse({
      job_id: JOB_ID,
      direction: 'inbound',
      occurred_at: NOW_ISO,
      duration_seconds: '999999',
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-uuid job ids', () => {
    const result = LogPhoneCallSchema.safeParse({
      job_id: 'not-a-uuid',
      direction: 'inbound',
      occurred_at: NOW_ISO,
      duration_seconds: '5',
    });
    expect(result.success).toBe(false);
  });
});

describe('shouldRecordFirstResponse', () => {
  it('records on a lead with no prior response', () => {
    expect(
      shouldRecordFirstResponse({
        stage: 'lead',
        firstResponseAt: null,
        occurredAt: NOW_ISO,
      }),
    ).toBe(true);
  });

  it('records on a contacted lead with no prior response', () => {
    expect(
      shouldRecordFirstResponse({
        stage: 'contacted',
        firstResponseAt: null,
        occurredAt: NOW_ISO,
      }),
    ).toBe(true);
  });

  it('does not double-stamp once first_response_at is set', () => {
    expect(
      shouldRecordFirstResponse({
        stage: 'lead',
        firstResponseAt: '2026-05-04T09:00:00Z',
        occurredAt: NOW_ISO,
      }),
    ).toBe(false);
  });

  it('skips stages past contacted', () => {
    expect(
      shouldRecordFirstResponse({
        stage: 'quoted',
        firstResponseAt: null,
        occurredAt: NOW_ISO,
      }),
    ).toBe(false);
    expect(
      shouldRecordFirstResponse({
        stage: 'paid',
        firstResponseAt: null,
        occurredAt: NOW_ISO,
      }),
    ).toBe(false);
  });

  it('skips malformed timestamps', () => {
    expect(
      shouldRecordFirstResponse({
        stage: 'lead',
        firstResponseAt: null,
        occurredAt: 'not-a-date',
      }),
    ).toBe(false);
  });
});
