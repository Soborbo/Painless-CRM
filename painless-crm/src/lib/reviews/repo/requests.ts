import { REVIEW_CONFIG } from '@/lib/reviews/engine/config';
import { computeNext } from '@/lib/reviews/engine/time';
import type { Status, TemplateId } from '@/lib/reviews/engine/types';
import type { createAdminClient } from '@/lib/supabase/admin';
import { customerDisplayName } from '@/lib/utils/format';

// review_requests repo on supabase-js (ADR-047). Service-role client; the sweep
// has no auth context. Untyped admin client → results are cast through `unknown`
// to local row types (same pattern as the legacy review-cron).

type Admin = ReturnType<typeof createAdminClient>;

export interface DueRequest {
  id: string;
  companyId: string;
  email: string;
  contactName: string;
  status: Status;
  attemptsSent: number;
  triggerAt: string;
  clickedReviewAt: string | null;
  lastSentAt: string | null;
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

const DUE_SELECT =
  'id, company_id, status, attempts_sent, trigger_at, clicked_review_at, last_sent_at, ' +
  'customer:customers(customer_type, first_name, last_name, company_name, primary_email)';

/** Requests whose next_send_at is due now, oldest first. */
export async function getDueRequests(
  supabase: Admin,
  nowIso: string,
  limit: number,
): Promise<DueRequest[]> {
  const { data } = await supabase
    .from('review_requests')
    .select(DUE_SELECT)
    .in('status', ['pending', 'active'])
    .is('deleted_at', null)
    .not('next_send_at', 'is', null)
    .lte('next_send_at', nowIso)
    .order('next_send_at', { ascending: true })
    .limit(limit);

  const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;
  const out: DueRequest[] = [];
  for (const r of rows) {
    const customer = one<CustomerEmbed>(r.customer);
    const email = customer?.primary_email;
    if (!customer || !email) continue;
    out.push({
      id: r.id as string,
      companyId: r.company_id as string,
      email,
      contactName: customerDisplayName(customer),
      status: r.status as Status,
      attemptsSent: (r.attempts_sent as number) ?? 0,
      triggerAt: (r.trigger_at as string | null) ?? new Date().toISOString(),
      clickedReviewAt: (r.clicked_review_at as string | null) ?? null,
      lastSentAt: (r.last_sent_at as string | null) ?? null,
    });
  }
  return out;
}

/** CLAIM step (crash-safe send §6): the UNIQUE idempotency_key dedups. */
export async function claimSend(
  supabase: Admin,
  idemKey: string,
  companyId: string,
  requestId: string,
  attemptNo: number,
  templateId: TemplateId,
): Promise<boolean> {
  const { error } = await supabase.from('review_send_log').insert({
    company_id: companyId,
    request_id: requestId,
    attempt_no: attemptNo,
    channel: 'email',
    template_id: templateId,
    idempotency_key: idemKey,
    sent_at: new Date().toISOString(),
  });
  if (!error) return true;
  if (error.code === '23505') return false; // already claimed
  throw error;
}

/** CONFIRM step: stamp the provider id, then advance the request row. */
export async function confirmSend(
  supabase: Admin,
  idemKey: string,
  requestId: string,
  attemptNo: number,
  lastSentIso: string,
  nextSendIso: string | null,
  providerId: string,
): Promise<void> {
  await supabase
    .from('review_send_log')
    .update({ provider_id: providerId })
    .eq('idempotency_key', idemKey);
  await supabase
    .from('review_requests')
    .update({
      attempts_sent: attemptNo,
      last_sent_at: lastSentIso,
      next_send_at: nextSendIso,
      status: 'active',
      updated_at: lastSentIso,
    })
    .eq('id', requestId);
}

export async function setStatus(
  supabase: Admin,
  id: string,
  status: Status,
  manualReviewed = false,
): Promise<void> {
  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (manualReviewed) patch.manual_reviewed = true;
  await supabase.from('review_requests').update(patch).eq('id', id);
}

/**
 * Reconcile claims stuck unconfirmed (provider_id IS NULL) past the cutoff: the
 * send may have gone out, so we DON'T re-send — mark the claim reconciled and
 * advance the request to its next window as if the attempt landed (§16).
 */
export async function reconcileStuckClaims(supabase: Admin, cutoffIso: string): Promise<number> {
  const { data } = await supabase
    .from('review_send_log')
    .select('idempotency_key, attempt_no, sent_at, request:review_requests(id, trigger_at)')
    .is('provider_id', null)
    .lt('sent_at', cutoffIso);

  const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;
  let n = 0;
  const now = new Date().toISOString();
  for (const row of rows) {
    const req = one<{ id: string; trigger_at: string | null }>(row.request);
    if (!req) continue;
    const attempt = row.attempt_no as number;
    const triggerAt = req.trigger_at ?? (row.sent_at as string);
    const next = computeNext(
      triggerAt,
      REVIEW_CONFIG.scheduleDays,
      attempt,
      REVIEW_CONFIG.timezone,
      REVIEW_CONFIG.sendHours,
      REVIEW_CONFIG.sendDays,
    );
    await supabase
      .from('review_send_log')
      .update({ provider_id: 'reconciled' })
      .eq('idempotency_key', row.idempotency_key as string);
    await supabase
      .from('review_requests')
      .update({
        attempts_sent: attempt,
        last_sent_at: row.sent_at,
        next_send_at: next,
        updated_at: now,
      })
      .eq('id', req.id);
    n += 1;
  }
  return n;
}
