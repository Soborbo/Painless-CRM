import { serverEnv } from '@/lib/env';
import { sendReviewRequestEmail } from '@/lib/integrations/resend/review-request';
import { createAdminClient } from '@/lib/supabase/admin';
import { customerDisplayName } from '@/lib/utils/format';
import { type ReviewEmailVariant, buildReviewRequestEmail } from './email';
import { decideReviewAction } from './followup';

// Review-request sweep (Phase 11 §3/§4). Runs without a user, so it reads/writes
// with the service-role client. The pure cadence logic decides which pending
// requests are due for their initial send or a follow-up; this shell fetches
// the recipients, builds the universal email, sends, and advances the row.
// No branch on satisfaction — every paid customer is treated identically.

const MAX_REQUESTS = 2000;

const SELECT =
  'id, company_id, sent_at, followup_count, responded_at, ' +
  'customer:customers(customer_type, first_name, last_name, company_name, primary_email), ' +
  'signoff:customer_signoffs(job:jobs(paid_at))';

export interface ReviewCronResult {
  scanned: number;
  initialSent: number;
  followupsSent: number;
  skipped: number;
}

interface CustomerEmbed {
  customer_type: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  primary_email: string | null;
}

function one<T>(raw: unknown): T | null {
  if (Array.isArray(raw)) return (raw[0] as T) ?? null;
  return (raw as T) ?? null;
}

export async function runReviewRequestSweep(now: Date = new Date()): Promise<ReviewCronResult> {
  const supabase = createAdminClient();
  const appUrl = serverEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, '');

  const { data: rows } = await supabase
    .from('review_requests')
    .select(SELECT)
    .eq('status', 'pending')
    .is('deleted_at', null)
    .limit(MAX_REQUESTS);

  const requests = (rows ?? []) as unknown as Array<Record<string, unknown>>;
  const result: ReviewCronResult = {
    scanned: requests.length,
    initialSent: 0,
    followupsSent: 0,
    skipped: 0,
  };

  for (const req of requests) {
    const signoff = one<{ job: unknown }>(req.signoff);
    const job = one<{ paid_at: string | null }>(signoff?.job);
    const action = decideReviewAction(
      {
        sent_at: (req.sent_at as string | null) ?? null,
        followup_count: (req.followup_count as number) ?? 0,
        responded_at: (req.responded_at as string | null) ?? null,
        paid_at: job?.paid_at ?? null,
      },
      now,
    );
    if (action.kind === 'none') {
      result.skipped += 1;
      continue;
    }

    const customer = one<CustomerEmbed>(req.customer);
    const email = customer?.primary_email;
    if (!customer || !email) {
      result.skipped += 1;
      continue;
    }

    const token = req.id as string;
    const variant: ReviewEmailVariant =
      action.kind === 'send_initial'
        ? 'initial'
        : action.followupNumber === 1
          ? 'followup1'
          : 'followup2';
    const mail = buildReviewRequestEmail(variant, {
      customerName: customerDisplayName(customer),
      reviewUrl: `${appUrl}/r/${token}/review`,
      complaintsUrl: `${appUrl}/feedback/${token}`,
    });
    await sendReviewRequestEmail({
      to: email,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    });

    if (action.kind === 'send_initial') {
      await supabase.from('review_requests').update({ sent_at: now.toISOString() }).eq('id', token);
      result.initialSent += 1;
    } else {
      await supabase
        .from('review_requests')
        .update({ followup_count: action.followupNumber })
        .eq('id', token);
      result.followupsSent += 1;
    }
  }

  return result;
}
