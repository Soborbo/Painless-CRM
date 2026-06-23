import { type ReviewFunnelRow, buildReviewFunnel } from '@/lib/reports/review-funnel';
import { describe, expect, it } from 'vitest';

function row(p: Partial<ReviewFunnelRow>): ReviewFunnelRow {
  return { status: 'active', attempts_sent: 1, clicked_review_at: null, ...p };
}

describe('buildReviewFunnel', () => {
  it('counts the lifecycle and derives rates off emailed', () => {
    const rows: ReviewFunnelRow[] = [
      // emailed + clicked + reviewed
      row({ status: 'reviewed', attempts_sent: 2, clicked_review_at: '2026-06-10T10:00:00Z' }),
      // emailed + clicked, not yet reviewed
      row({ status: 'active', attempts_sent: 1, clicked_review_at: '2026-06-11T10:00:00Z' }),
      // emailed, complained
      row({ status: 'complained', attempts_sent: 1 }),
      // emailed, exhausted (no response)
      row({ status: 'exhausted', attempts_sent: 4 }),
      // emailed, unsubscribed
      row({ status: 'unsubscribed', attempts_sent: 1 }),
      // queued but never emailed yet (pending, attempts 0)
      row({ status: 'pending', attempts_sent: 0 }),
    ];

    const f = buildReviewFunnel(rows);
    expect(f.requests).toBe(6);
    expect(f.sent).toBe(5); // the pending/0-attempt one is not counted
    expect(f.clicked).toBe(2);
    expect(f.reviewed).toBe(1);
    expect(f.complained).toBe(1);
    expect(f.unsubscribed).toBe(1);
    expect(f.exhausted).toBe(1);
    expect(f.inFlight).toBe(2); // active + pending
    expect(f.ctrPct).toBeCloseTo((2 / 5) * 100);
    expect(f.reviewRatePct).toBeCloseTo((1 / 5) * 100);
    expect(f.complaintRatePct).toBeCloseTo((1 / 5) * 100);
  });

  it('returns zeros and null rates for an empty cohort', () => {
    const f = buildReviewFunnel([]);
    expect(f).toMatchObject({ requests: 0, sent: 0, clicked: 0, reviewed: 0, inFlight: 0 });
    expect(f.ctrPct).toBeNull();
    expect(f.reviewRatePct).toBeNull();
    expect(f.complaintRatePct).toBeNull();
  });

  it('treats null attempts_sent as not-yet-emailed', () => {
    const f = buildReviewFunnel([row({ status: 'pending', attempts_sent: null })]);
    expect(f.sent).toBe(0);
    expect(f.reviewRatePct).toBeNull();
  });
});
