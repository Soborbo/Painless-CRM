import { type BreachLead, selectBreachNotifications } from '@/lib/notifications/sla-breach';
import { describe, expect, it } from 'vitest';

function lead(o: Partial<BreachLead>): BreachLead {
  return {
    job_id: 'j1',
    job_number: 'J-1',
    company_id: 'co1',
    assigned_to_id: 'u1',
    ...o,
  };
}

describe('selectBreachNotifications', () => {
  it('emits one notification per assigned overdue lead', () => {
    const out = selectBreachNotifications(
      [lead({ job_id: 'j1', assigned_to_id: 'u1' }), lead({ job_id: 'j2', assigned_to_id: 'u2' })],
      new Set(),
    );
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ jobId: 'j1', recipientUserId: 'u1', companyId: 'co1' });
  });

  it('skips leads with no assigned rep', () => {
    const out = selectBreachNotifications([lead({ assigned_to_id: null })], new Set());
    expect(out).toHaveLength(0);
  });

  it('skips leads already notified (dedup across cron runs)', () => {
    const out = selectBreachNotifications([lead({ job_id: 'j1' })], new Set(['j1']));
    expect(out).toHaveLength(0);
  });

  it('dedups duplicate leads within a single run by job id', () => {
    const out = selectBreachNotifications(
      [lead({ job_id: 'j1' }), lead({ job_id: 'j1' })],
      new Set(),
    );
    expect(out).toHaveLength(1);
  });
});
