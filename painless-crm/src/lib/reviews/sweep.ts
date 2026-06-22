import { serverEnv } from '@/lib/env';
import { ResendChannel } from '@/lib/reviews/channels/resend';
import { buildReviewEmail } from '@/lib/reviews/email';
import { REVIEW_CONFIG } from '@/lib/reviews/engine/config';
import { decideAction } from '@/lib/reviews/engine/logic';
import { computeNext, roundToWindow } from '@/lib/reviews/engine/time';
import type { TemplateId } from '@/lib/reviews/engine/types';
import {
  type DueRequest,
  claimSend,
  confirmSend,
  getDueRequests,
  reconcileStuckClaims,
  setStatus,
} from '@/lib/reviews/repo/requests';
import { isSuppressed } from '@/lib/reviews/repo/suppression';
import { createAdminClient } from '@/lib/supabase/admin';

// The review-engine send loop (ADR-047), single-tenant. Replaces the legacy
// runReviewRequestSweep: it adds the brain's nudge_1..4 → post_click cadence and
// crash-safe send (claim → send → confirm), plus an in-line reconcile of stuck
// claims so a crash between send and confirm never double-sends. No NPS gating.

const MAX_REQUESTS = 2000;
const STUCK_CLAIM_MS = 15 * 60 * 1000;

type Admin = ReturnType<typeof createAdminClient>;

export interface ReviewSweepResult {
  scanned: number;
  sent: number;
  closed: number;
  skipped: number;
  reconciled: number;
}

export async function runReviewSweep(now: Date = new Date()): Promise<ReviewSweepResult> {
  const env = serverEnv();
  const supabase = createAdminClient();
  const channel = new ResendChannel(env.RESEND_API_KEY);
  const appUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
  const nowIso = now.toISOString();

  const due = await getDueRequests(supabase, nowIso, MAX_REQUESTS);
  const result: ReviewSweepResult = {
    scanned: due.length,
    sent: 0,
    closed: 0,
    skipped: 0,
    reconciled: 0,
  };

  for (const req of due) {
    const action = decideAction(
      {
        status: req.status,
        attemptsSent: req.attemptsSent,
        clickedReviewAt: req.clickedReviewAt,
        lastSentAt: req.lastSentAt,
      },
      REVIEW_CONFIG,
    );
    if (action.kind === 'skip') {
      result.skipped += 1;
    } else if (action.kind === 'close') {
      await setStatus(supabase, req.id, action.status);
      result.closed += 1;
    } else {
      const ok = await sendOne(
        supabase,
        channel,
        appUrl,
        req,
        action.attempt,
        action.template,
        now,
      );
      if (ok) result.sent += 1;
      else result.skipped += 1;
    }
  }

  const cutoff = new Date(now.getTime() - STUCK_CLAIM_MS).toISOString();
  result.reconciled = await reconcileStuckClaims(supabase, cutoff);
  return result;
}

/** Crash-safe single send (engine spec §6): claim → send → confirm. */
async function sendOne(
  supabase: Admin,
  channel: ResendChannel,
  appUrl: string,
  req: DueRequest,
  attempt: number,
  template: TemplateId,
  now: Date,
): Promise<boolean> {
  if (await isSuppressed(supabase, req.companyId, req.email)) {
    await setStatus(supabase, req.id, 'unsubscribed');
    return false;
  }

  const idemKey = `${req.id}:${attempt}`;
  if (!(await claimSend(supabase, idemKey, req.companyId, req.id, attempt, template))) {
    return false; // another run already claimed this attempt
  }

  try {
    const mail = buildReviewEmail(template, {
      customerName: req.contactName,
      reviewUrl: `${appUrl}/r/${req.id}/review`,
      complaintsUrl: `${appUrl}/feedback/${req.id}`,
    });
    const unsubscribeUrl = `${appUrl}/u/${req.id}`;
    const { providerId } = await channel.send({
      to: req.email,
      toName: req.contactName,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      headers: {
        'List-Unsubscribe': `<${unsubscribeUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    });

    const nextSend =
      template === 'post_click'
        ? roundToWindow(
            new Date(now.getTime() + 60_000),
            REVIEW_CONFIG.timezone,
            REVIEW_CONFIG.sendHours,
            REVIEW_CONFIG.sendDays,
          )
        : computeNext(
            req.triggerAt,
            REVIEW_CONFIG.scheduleDays,
            attempt,
            REVIEW_CONFIG.timezone,
            REVIEW_CONFIG.sendHours,
            REVIEW_CONFIG.sendDays,
          );

    await confirmSend(supabase, idemKey, req.id, attempt, now.toISOString(), nextSend, providerId);

    // Final nudge sent with no further schedule → exhausted.
    if (template !== 'post_click' && nextSend === null) {
      await setStatus(supabase, req.id, 'exhausted');
    }
    return true;
  } catch {
    // Leave the claim row unconfirmed (provider_id NULL) → reconcile sweep heals it.
    return false;
  }
}
