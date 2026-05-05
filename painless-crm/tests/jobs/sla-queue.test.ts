import { type SlaQueueRow, bucketSlaQueue } from '@/lib/queries/sla-queue';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-05-04T12:00:00Z');

function row(overrides: Partial<SlaQueueRow>): SlaQueueRow {
  return {
    id: 'j1',
    job_number: 'J2026-00001',
    stage: 'lead',
    acquisition_source: 'website',
    enquiry_at: '2026-05-04T11:45:00Z',
    first_response_due_at: '2026-05-04T12:00:00Z',
    customer: null,
    assigned_to: null,
    ...overrides,
  };
}

describe('bucketSlaQueue', () => {
  it('puts past-deadline leads into overdue', () => {
    const r = row({ id: 'late', first_response_due_at: '2026-05-04T11:00:00Z' });
    const out = bucketSlaQueue([r], NOW);
    expect(out.overdue).toHaveLength(1);
    expect(out.overdue[0]?.id).toBe('late');
    expect(out.dueSoon).toHaveLength(0);
    expect(out.onTrack).toHaveLength(0);
  });

  it('flags leads in the warn window as dueSoon', () => {
    const r = row({
      enquiry_at: '2026-05-04T11:00:00Z',
      first_response_due_at: '2026-05-04T12:10:00Z',
    });
    const out = bucketSlaQueue([r], NOW);
    expect(out.dueSoon).toHaveLength(1);
    expect(out.overdue).toHaveLength(0);
    expect(out.onTrack).toHaveLength(0);
  });

  it('puts comfortably-future leads in onTrack', () => {
    const r = row({
      enquiry_at: '2026-05-04T11:50:00Z',
      first_response_due_at: '2026-05-04T13:00:00Z',
    });
    const out = bucketSlaQueue([r], NOW);
    expect(out.onTrack).toHaveLength(1);
  });

  it('handles a mixed batch', () => {
    const rows = [
      row({ id: 'a', first_response_due_at: '2026-05-04T11:00:00Z' }),
      row({
        id: 'b',
        enquiry_at: '2026-05-04T11:00:00Z',
        first_response_due_at: '2026-05-04T12:10:00Z',
      }),
      row({
        id: 'c',
        enquiry_at: '2026-05-04T11:50:00Z',
        first_response_due_at: '2026-05-04T13:00:00Z',
      }),
    ];
    const out = bucketSlaQueue(rows, NOW);
    expect(out.overdue.map((r) => r.id)).toEqual(['a']);
    expect(out.dueSoon.map((r) => r.id)).toEqual(['b']);
    expect(out.onTrack.map((r) => r.id)).toEqual(['c']);
  });
});
