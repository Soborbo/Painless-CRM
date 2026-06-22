import type { Action, PostClick, RequestDecisionState, TemplateId } from './types';

// Pure decision logic ported from Soborbo/reviewengine `core/logic.ts`. No I/O,
// no DB — unit-tested in isolation. The sweep (lib/reviews/sweep.ts) feeds it
// rows + the company config and acts on the returned Action.

/** max attempts = scheduleDays.length (engine spec §5). */
export function maxAttempts(scheduleDays: number[]): number {
  return scheduleDays.length;
}

/**
 * Decide what to do with a single request before sending (engine spec §6).
 * The review-click is resolved HERE (in the sweep), not in the public /r route,
 * so a mail-scanner pre-click can't prematurely kill the nudge sequence.
 */
export function decideAction(
  req: RequestDecisionState,
  config: { scheduleDays: number[]; postClick: PostClick },
): Action {
  if (req.status !== 'pending' && req.status !== 'active') {
    return { kind: 'skip', reason: `status=${req.status}` };
  }

  if (req.clickedReviewAt) {
    if (config.postClick === 'stop') return { kind: 'close', status: 'reviewed' };
    // The single post-click reminder was already sent → close as reviewed.
    if (req.lastSentAt && req.lastSentAt >= req.clickedReviewAt) {
      return { kind: 'close', status: 'reviewed' };
    }
    return { kind: 'send', attempt: req.attemptsSent + 1, template: 'post_click' };
  }

  const attempt = req.attemptsSent + 1;
  if (attempt > maxAttempts(config.scheduleDays)) {
    return { kind: 'close', status: 'exhausted' };
  }
  return { kind: 'send', attempt, template: `nudge_${attempt}` as TemplateId };
}

export interface BudgetSplit {
  total: number;
  followupCap: number;
  firstTouchCap: number;
}

/**
 * Per-window send budget (anti-starvation, engine spec §6). Phase 1 leaves caps
 * effectively unlimited, but the math is ported + tested for when ramp/cap turn
 * on: reserve `followupBudgetPct` of the window for in-flight follow-ups so
 * first-touches can't starve them, and spread the day's allowance across windows.
 */
export function windowBudget(
  campRemain: number,
  windowsLeft: number,
  globalRemain: number,
  followupBudgetPct: number,
): BudgetSplit {
  if (campRemain <= 0 || globalRemain <= 0 || windowsLeft <= 0) {
    return { total: 0, followupCap: 0, firstTouchCap: 0 };
  }
  const spread = Math.ceil(campRemain / windowsLeft);
  const total = Math.min(spread, globalRemain, campRemain);
  const followupCap = Math.floor((total * followupBudgetPct) / 100);
  return { total, followupCap, firstTouchCap: total - followupCap };
}

/** Count of send windows at or after the current local hour (spread denominator). */
export function windowsRemaining(sendHours: number[], currentHour: number): number {
  return sendHours.filter((h) => h >= currentHour).length;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com',
  'guerrillamail.com',
  '10minutemail.com',
  'tempmail.com',
  'trashmail.com',
  'yopmail.com',
  'throwawaymail.com',
  'getnada.com',
  'sharklasers.com',
  'maildrop.cc',
]);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Lightweight validation: syntax + disposable-domain blocklist (engine spec §8). */
export function isAcceptableEmail(email: string): boolean {
  const e = normalizeEmail(email);
  if (!EMAIL_RE.test(e)) return false;
  const domain = e.slice(e.lastIndexOf('@') + 1);
  return !DISPOSABLE_DOMAINS.has(domain);
}
