// Review-engine domain types — ported from Soborbo/reviewengine `core/`, made
// single-tenant for the CRM (no campaign / project_key tenancy; the tenant is
// the CRM's company_id). DB-agnostic: the repo layer maps `review_requests`
// rows to/from these shapes. See proposals/ADR-047.

export type Status =
  | 'pending'
  | 'active'
  | 'reviewed'
  | 'complained'
  | 'unsubscribed'
  | 'exhausted';

export type PostClick = 'stop' | 'one_more';

export type TemplateId = 'nudge_1' | 'nudge_2' | 'nudge_3' | 'nudge_4' | 'post_click';

/**
 * The send-cadence + window settings the brain reads. Single-tenant: one
 * effective config per company (ADR-047). The concrete value lives in
 * `config.ts`; capacity fields (`dailySendCap`/`ramp`) are Phase-1 no-ops.
 */
export interface ReviewEngineConfig {
  /** Day offsets from `trigger_at`; `length` = max attempts. Painless: [1,4,7,14]. */
  scheduleDays: number[];
  /** After a review-link click: send one more nudge then stop, or stop now. */
  postClick: PostClick;
  /** IANA tz for the send windows below (DST-safe). */
  timezone: string;
  /** Local hours (0-23) a send may go out. */
  sendHours: number[];
  /** ISO weekdays (1=Mon..7=Sun) a send may go out. */
  sendDays: number[];
  // ---- capacity controls (deferred in Phase 1; defaults make them no-ops) ----
  dailySendCap: number;
  ramp: number[] | null;
  rampStartedAt: string | null;
  followupBudgetPct: number;
}

/** The per-request fields `decideAction` needs (a subset of `review_requests`). */
export interface RequestDecisionState {
  status: Status;
  attemptsSent: number;
  clickedReviewAt: string | null;
  lastSentAt: string | null;
}

/** Result of `decideAction` — pure, computed per request before sending. */
export type Action =
  | { kind: 'skip'; reason: string }
  | { kind: 'close'; status: Extract<Status, 'reviewed' | 'complained' | 'exhausted'> }
  | { kind: 'send'; attempt: number; template: TemplateId };
