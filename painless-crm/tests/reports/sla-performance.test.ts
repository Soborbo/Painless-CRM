import { type SlaJobRow, buildSlaPerformance } from '@/lib/reports/sla-performance';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-06-02T12:00:00Z');

function row(o: Partial<SlaJobRow>): SlaJobRow {
  return {
    enquiry_at: '2026-06-01T10:00:00Z',
    first_response_due_at: '2026-06-01T11:00:00Z',
    first_response_at: null,
    assigned_to_id: 'u1',
    assigned_to_name: 'Pete',
    ...o,
  };
}

describe('buildSlaPerformance', () => {
  it('classifies on-time, late and unanswered-overdue leads', () => {
    const { overall } = buildSlaPerformance(
      [
        // answered before the deadline → on time
        row({ first_response_at: '2026-06-01T10:30:00Z' }),
        // answered after the deadline → breached
        row({ first_response_at: '2026-06-01T11:30:00Z' }),
        // unanswered and past due (now is later) → breached
        row({ first_response_at: null }),
      ],
      NOW,
    );
    expect(overall.total).toBe(3);
    expect(overall.onTime).toBe(1);
    expect(overall.breached).toBe(2);
    expect(overall.pending).toBe(0);
    expect(overall.breachPct).toBeCloseTo((2 / 3) * 100);
  });

  it('treats an unanswered lead still within SLA as pending, excluded from breach rate', () => {
    const { overall } = buildSlaPerformance(
      [
        row({ first_response_at: '2026-06-01T10:30:00Z' }), // on time
        row({ first_response_due_at: '2026-06-02T18:00:00Z', first_response_at: null }), // due later than NOW
      ],
      NOW,
    );
    expect(overall.pending).toBe(1);
    expect(overall.breached).toBe(0);
    // decided = 1 (the on-time one) → 0% breach
    expect(overall.breachPct).toBe(0);
  });

  it('averages response time from enquiry to first response', () => {
    const { overall } = buildSlaPerformance(
      [
        row({ enquiry_at: '2026-06-01T10:00:00Z', first_response_at: '2026-06-01T10:30:00Z' }), // 30m
        row({ enquiry_at: '2026-06-01T10:00:00Z', first_response_at: '2026-06-01T11:30:00Z' }), // 90m
      ],
      NOW,
    );
    expect(overall.avgResponseMins).toBe(60);
  });

  it('ignores leads without an SLA deadline', () => {
    const { overall } = buildSlaPerformance([row({ first_response_due_at: null })], NOW);
    expect(overall.total).toBe(0);
    expect(overall.breachPct).toBeNull();
  });

  it('builds a per-rep leaderboard ranked by on-time rate', () => {
    const { byRep } = buildSlaPerformance(
      [
        // u1: 1 on-time
        row({
          assigned_to_id: 'u1',
          assigned_to_name: 'Pete',
          first_response_at: '2026-06-01T10:30:00Z',
        }),
        // u2: 1 breached
        row({
          assigned_to_id: 'u2',
          assigned_to_name: 'Sam',
          first_response_at: '2026-06-01T11:30:00Z',
        }),
      ],
      NOW,
    );
    expect(byRep.map((r) => r.repName)).toEqual(['Pete', 'Sam']);
    expect(byRep[0]?.onTime).toBe(1);
    expect(byRep[1]?.breached).toBe(1);
  });

  it('buckets unassigned leads under a single row', () => {
    const { byRep } = buildSlaPerformance(
      [
        row({
          assigned_to_id: null,
          assigned_to_name: null,
          first_response_at: '2026-06-01T10:30:00Z',
        }),
      ],
      NOW,
    );
    expect(byRep).toHaveLength(1);
    expect(byRep[0]?.repName).toBe('Unassigned');
  });
});
