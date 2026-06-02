import { bandFor, computeHealthScore } from '@/lib/customers/health';
import { describe, expect, it } from 'vitest';

describe('computeHealthScore', () => {
  it('rewards a happy, recent customer with active storage', () => {
    const r = computeHealthScore({ lastNps: 10, daysSinceActivity: 5, hasActiveStorage: true });
    expect(r.score).toBe(100);
    expect(r.band).toBe('good');
  });

  it('flags churn risk for an unhappy, stale customer', () => {
    const r = computeHealthScore({ lastNps: 1, daysSinceActivity: 400, hasActiveStorage: false });
    expect(r.score).toBe(5); // 5 NPS pts only
    expect(r.band).toBe('churn_risk');
  });

  it('awards a neutral NPS share when no survey exists', () => {
    // 25 (neutral nps) + 35 (fresh) + 0 = 60 → at_risk
    const r = computeHealthScore({ lastNps: null, daysSinceActivity: 10, hasActiveStorage: false });
    expect(r.score).toBe(60);
    expect(r.band).toBe('at_risk');
  });

  it('gives zero recency points when never active', () => {
    // 25 neutral nps + 0 recency + 15 storage = 40
    const r = computeHealthScore({ lastNps: null, daysSinceActivity: null, hasActiveStorage: true });
    expect(r.score).toBe(40);
  });

  it('decays recency linearly between 30 and 365 days', () => {
    const mid = computeHealthScore({
      lastNps: 0,
      daysSinceActivity: Math.round((30 + 365) / 2),
      hasActiveStorage: false,
    });
    // ~half of the 35-pt recency weight
    expect(mid.score).toBe(17);
  });

  it('maps scores to bands', () => {
    expect(bandFor(70)).toBe('good');
    expect(bandFor(69)).toBe('at_risk');
    expect(bandFor(40)).toBe('at_risk');
    expect(bandFor(39)).toBe('churn_risk');
  });
});
