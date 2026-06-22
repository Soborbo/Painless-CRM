import {
  decideAction,
  isAcceptableEmail,
  maxAttempts,
  normalizeEmail,
  windowBudget,
  windowsRemaining,
} from '@/lib/reviews/engine/logic';
import type { PostClick, RequestDecisionState } from '@/lib/reviews/engine/types';
import { describe, expect, it } from 'vitest';

// Painless cadence (ADR-047): 4 sends at +24h / +4d / +7d / +14d.
const config = { scheduleDays: [1, 4, 7, 14], postClick: 'one_more' as PostClick };

function req(p: Partial<RequestDecisionState>): RequestDecisionState {
  return { status: 'active', attemptsSent: 0, clickedReviewAt: null, lastSentAt: null, ...p };
}

describe('decideAction', () => {
  it('skips terminal statuses', () => {
    expect(decideAction(req({ status: 'reviewed' }), config).kind).toBe('skip');
  });

  it('sends nudge_1 for a fresh request', () => {
    expect(decideAction(req({ attemptsSent: 0 }), config)).toEqual({
      kind: 'send',
      attempt: 1,
      template: 'nudge_1',
    });
  });

  it('sends nudge_4 as the last scheduled nudge', () => {
    expect(decideAction(req({ attemptsSent: 3 }), config)).toEqual({
      kind: 'send',
      attempt: 4,
      template: 'nudge_4',
    });
  });

  it('exhausts after the last scheduled nudge', () => {
    expect(decideAction(req({ attemptsSent: 4 }), config)).toEqual({
      kind: 'close',
      status: 'exhausted',
    });
  });

  it('closes reviewed on click when post_click=stop', () => {
    const stop = { ...config, postClick: 'stop' as PostClick };
    expect(decideAction(req({ clickedReviewAt: '2026-06-14T10:00:00Z' }), stop)).toEqual({
      kind: 'close',
      status: 'reviewed',
    });
  });

  it('sends one post_click reminder, then closes reviewed', () => {
    const clicked = '2026-06-14T10:00:00Z';
    expect(decideAction(req({ clickedReviewAt: clicked, attemptsSent: 1 }), config)).toEqual({
      kind: 'send',
      attempt: 2,
      template: 'post_click',
    });
    // After the reminder was sent (last_sent_at >= clicked) → close.
    expect(
      decideAction(
        req({ clickedReviewAt: clicked, lastSentAt: '2026-06-14T11:00:00Z', attemptsSent: 2 }),
        config,
      ),
    ).toEqual({ kind: 'close', status: 'reviewed' });
  });
});

describe('budget math', () => {
  it('splits follow-up vs first-touch by percentage', () => {
    expect(windowBudget(100, 2, Number.POSITIVE_INFINITY, 70)).toEqual({
      total: 50,
      followupCap: 35,
      firstTouchCap: 15,
    });
  });
  it('is zero when nothing remains', () => {
    expect(windowBudget(0, 3, 10, 70).total).toBe(0);
  });
  it('counts remaining windows at/after the current hour', () => {
    expect(windowsRemaining([9, 13, 17], 13)).toBe(2);
  });
});

describe('misc', () => {
  it('maxAttempts = scheduleDays.length', () => {
    expect(maxAttempts(config.scheduleDays)).toBe(4);
  });
  it('normalizes and validates emails', () => {
    expect(normalizeEmail('  Foo@Bar.COM ')).toBe('foo@bar.com');
    expect(isAcceptableEmail('a@b.com')).toBe(true);
    expect(isAcceptableEmail('nope')).toBe(false);
    expect(isAcceptableEmail('x@mailinator.com')).toBe(false);
  });
});
