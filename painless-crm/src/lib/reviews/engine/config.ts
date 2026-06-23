import type { ReviewEngineConfig } from './types';

// The single effective review-engine config for Painless (ADR-047, single-tenant).
// Cadence: 4 sends at +24h / +4d / +7d / +14d after the job's `paid_at`. A click
// on the review link triggers one final "post-click" nudge, then stops.
// Capacity controls are deferred (Phase 1): an effectively unlimited daily cap
// and no warmup ramp — revisit only if volume grows or deliverability dips.
export const REVIEW_CONFIG: ReviewEngineConfig = {
  scheduleDays: [1, 4, 7, 14],
  postClick: 'one_more',
  timezone: 'Europe/London',
  sendHours: [10],
  sendDays: [1, 2, 3, 4, 5, 6],
  dailySendCap: Number.MAX_SAFE_INTEGER,
  ramp: null,
  rampStartedAt: null,
  followupBudgetPct: 70,
};
