// Phase 11 §3/§4 — universal review-request cadence (no NPS gating, see
// ADR-010). Pure, date-injectable decision logic so the cron stays a thin shell.
//
// Cadence, measured per request:
//   - initial send: 24h after the job's `paid_at` (let the customer settle in)
//   - follow-up #1: +7 days after the initial send, if no response yet
//   - follow-up #2: +14 days after the initial send, if still no response
//   - then stop. A click on either link sets `responded_at` and stops all sends.
//
// Every paid customer is treated identically. There is deliberately NO branch
// on satisfaction, internal rating, or complaint history anywhere here.

export const INITIAL_DELAY_MS = 24 * 60 * 60 * 1000;
export const FOLLOWUP_1_DELAY_MS = 7 * 24 * 60 * 60 * 1000;
export const FOLLOWUP_2_DELAY_MS = 14 * 24 * 60 * 60 * 1000;

export interface ReviewRequestState {
  sent_at: string | null; // initial send timestamp (null until first send)
  followup_count: number; // 0, 1, or 2
  responded_at: string | null; // set when either link is clicked
  paid_at: string | null; // the job's paid_at
}

export type ReviewAction =
  | { kind: 'none' }
  | { kind: 'send_initial' }
  | { kind: 'send_followup'; followupNumber: 1 | 2 };

const NONE: ReviewAction = { kind: 'none' };

export function decideReviewAction(state: ReviewRequestState, now: Date): ReviewAction {
  // A click on either link stops everything.
  if (state.responded_at) return NONE;

  const nowMs = now.getTime();

  // Initial send: gated on paid_at + 24h.
  if (!state.sent_at) {
    if (!state.paid_at) return NONE;
    const due = new Date(state.paid_at).getTime() + INITIAL_DELAY_MS;
    return nowMs >= due ? { kind: 'send_initial' } : NONE;
  }

  const sentMs = new Date(state.sent_at).getTime();
  if (state.followup_count === 0 && nowMs >= sentMs + FOLLOWUP_1_DELAY_MS) {
    return { kind: 'send_followup', followupNumber: 1 };
  }
  if (state.followup_count === 1 && nowMs >= sentMs + FOLLOWUP_2_DELAY_MS) {
    return { kind: 'send_followup', followupNumber: 2 };
  }
  return NONE;
}
