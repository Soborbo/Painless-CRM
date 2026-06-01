import { decideReviewAction } from '@/lib/reviews/followup';
import { describe, expect, it } from 'vitest';

const PAID = '2026-01-01T00:00:00.000Z';
const hours = (n: number) => new Date(Date.parse(PAID) + n * 3600_000);
const days = (n: number) => hours(n * 24);

describe('decideReviewAction', () => {
  it('waits 24h after paid before the initial send', () => {
    const base = { sent_at: null, followup_count: 0, responded_at: null, paid_at: PAID };
    expect(decideReviewAction(base, hours(23)).kind).toBe('none');
    expect(decideReviewAction(base, hours(24)).kind).toBe('send_initial');
  });

  it('does nothing until the job is paid', () => {
    const r = decideReviewAction(
      { sent_at: null, followup_count: 0, responded_at: null, paid_at: null },
      days(30),
    );
    expect(r.kind).toBe('none');
  });

  it('sends follow-up #1 at +7d and #2 at +14d from the initial send', () => {
    const sent = { sent_at: PAID, followup_count: 0, responded_at: null, paid_at: PAID };
    expect(decideReviewAction(sent, days(6)).kind).toBe('none');
    const f1 = decideReviewAction(sent, days(7));
    expect(f1).toEqual({ kind: 'send_followup', followupNumber: 1 });

    const afterF1 = { ...sent, followup_count: 1 };
    expect(decideReviewAction(afterF1, days(13)).kind).toBe('none');
    const f2 = decideReviewAction(afterF1, days(14));
    expect(f2).toEqual({ kind: 'send_followup', followupNumber: 2 });
  });

  it('stops after two follow-ups', () => {
    const done = { sent_at: PAID, followup_count: 2, responded_at: null, paid_at: PAID };
    expect(decideReviewAction(done, days(60)).kind).toBe('none');
  });

  it('stops the moment either link is clicked (responded_at set)', () => {
    const responded = {
      sent_at: PAID,
      followup_count: 0,
      responded_at: days(2).toISOString(),
      paid_at: PAID,
    };
    expect(decideReviewAction(responded, days(30)).kind).toBe('none');
  });
});
