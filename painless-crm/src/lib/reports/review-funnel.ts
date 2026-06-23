// Review-request funnel (ADR-047 Phase 2). Pure aggregation over the
// review_requests cohort in a window: how many paid customers were emailed,
// clicked through to Google, and converted to a review — plus the terminal-outcome
// breakdown. Observability only; no NPS gating (ADR-010). The Supabase read lives
// in lib/queries/reports.listReviewRequests.

export interface ReviewFunnelRow {
  status: string;
  attempts_sent: number | null;
  clicked_review_at: string | null;
}

export interface ReviewFunnel {
  /** Requests created in the window. */
  requests: number;
  /** Requests that received at least one email (attempts_sent > 0). */
  sent: number;
  /** Requests where the recipient clicked the Google review link. */
  clicked: number;
  reviewed: number;
  complained: number;
  unsubscribed: number;
  exhausted: number;
  /** Still pending or active (the cadence hasn't finished). */
  inFlight: number;
  /** clicked / sent, 0–100, or null when nothing was emailed. */
  ctrPct: number | null;
  /** reviewed / sent. */
  reviewRatePct: number | null;
  /** complained / sent. */
  complaintRatePct: number | null;
}

function pct(n: number, d: number): number | null {
  return d > 0 ? (n / d) * 100 : null;
}

export function buildReviewFunnel(rows: readonly ReviewFunnelRow[]): ReviewFunnel {
  let sent = 0;
  let clicked = 0;
  let reviewed = 0;
  let complained = 0;
  let unsubscribed = 0;
  let exhausted = 0;
  let inFlight = 0;

  for (const r of rows) {
    if ((r.attempts_sent ?? 0) > 0) sent += 1;
    if (r.clicked_review_at) clicked += 1;
    switch (r.status) {
      case 'reviewed':
        reviewed += 1;
        break;
      case 'complained':
        complained += 1;
        break;
      case 'unsubscribed':
        unsubscribed += 1;
        break;
      case 'exhausted':
        exhausted += 1;
        break;
      case 'pending':
      case 'active':
        inFlight += 1;
        break;
    }
  }

  return {
    requests: rows.length,
    sent,
    clicked,
    reviewed,
    complained,
    unsubscribed,
    exhausted,
    inFlight,
    ctrPct: pct(clicked, sent),
    reviewRatePct: pct(reviewed, sent),
    complaintRatePct: pct(complained, sent),
  };
}
