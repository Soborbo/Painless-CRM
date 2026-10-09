import { emitEvent } from '@/lib/notifications/emit';
import type { createAdminClient } from '@/lib/supabase/admin';
import { mapCdrToPhoneCall, type MappedCall, type TamarCdr } from './cdr';

// Ingests Tamar CDRs into `phone_calls` (source='tamar_api'). Runs without a
// user (service-role) from the poll cron. Each call is matched to a customer by
// caller number, then to that customer's most recent live job, and upserted on
// the (company_id, source, external_id) unique index so re-polling an
// overlapping window never duplicates a row.

type AnyClient = ReturnType<typeof createAdminClient>;

export interface IngestResult {
  mapped: number;
  skipped: number;
  upserted: number;
  matchedCustomer: number;
  matchedJob: number;
  missedNotified: number;
}

/** Candidate stored formats for an E.164 UK number, so an exact-match lookup
 *  finds customers whose primary_phone was saved national ("07…") or with a
 *  space-stripped "+44…". Pure + exported for tests. */
export function phoneMatchVariants(e164: string | null): string[] {
  if (!e164) return [];
  const out = new Set<string>([e164]);
  if (e164.startsWith('+44')) {
    const national = `0${e164.slice(3)}`;
    out.add(national);
    out.add(e164.slice(1)); // "44…"
  }
  return [...out];
}

async function findCustomerIdByPhone(
  supabase: AnyClient,
  companyId: string,
  e164: string | null,
): Promise<string | null> {
  const variants = phoneMatchVariants(e164);
  if (variants.length === 0) return null;
  const { data } = await supabase
    .from('customers')
    .select('id')
    .eq('company_id', companyId)
    .is('deleted_at', null)
    .in('primary_phone', variants)
    .limit(1);
  return (data?.[0]?.id as string | undefined) ?? null;
}

async function findLatestJobId(
  supabase: AnyClient,
  companyId: string,
  customerId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('jobs')
    .select('id')
    .eq('company_id', companyId)
    .eq('customer_id', customerId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1);
  return (data?.[0]?.id as string | undefined) ?? null;
}

export async function ingestTamarCdrs(
  supabase: AnyClient,
  opts: { companyId: string; ourNumbers: string[]; cdrs: TamarCdr[] },
): Promise<IngestResult> {
  const result: IngestResult = {
    mapped: 0,
    skipped: 0,
    upserted: 0,
    matchedCustomer: 0,
    matchedJob: 0,
    missedNotified: 0,
  };

  // Which CDRs have we already ingested? Only genuinely new rows fire the
  // "missed inbound call" notification — re-polling an overlapping window must
  // never re-notify. The unique index makes the upsert itself idempotent; this
  // set makes the side-effect idempotent too.
  const mappedCalls: MappedCall[] = [];
  for (const raw of opts.cdrs) {
    const mapped = mapCdrToPhoneCall(raw, opts.ourNumbers);
    if (!mapped.ok) {
      result.skipped += 1;
      continue;
    }
    result.mapped += 1;
    mappedCalls.push(mapped.call);
  }
  const seen = await loadSeenExternalIds(
    supabase,
    opts.companyId,
    mappedCalls.map((c) => c.external_id),
  );

  for (const call of mappedCalls) {
    const isNew = !seen.has(call.external_id);

    // For inbound calls the external party is the caller; match on that.
    const externalParty = call.direction === 'inbound' ? call.caller_number : call.called_number;
    const customerId = await findCustomerIdByPhone(supabase, opts.companyId, externalParty);
    if (customerId) result.matchedCustomer += 1;
    const jobId = customerId
      ? await findLatestJobId(supabase, opts.companyId, customerId)
      : null;
    if (jobId) result.matchedJob += 1;

    const { error } = await supabase.from('phone_calls').upsert(
      {
        company_id: opts.companyId,
        external_id: call.external_id,
        source: call.source,
        direction: call.direction,
        caller_number: call.caller_number,
        called_number: call.called_number,
        duration_seconds: call.duration_seconds,
        occurred_at: call.occurred_at,
        outcome: call.outcome,
        customer_id: customerId,
        job_id: jobId,
      },
      { onConflict: 'company_id,source,external_id', ignoreDuplicates: false },
    );
    if (error) continue;
    result.upserted += 1;

    // Notify subscribers of a new, unanswered inbound call (ADR-040/041). The
    // mapper derives `missed` from Tamar's call_result ("Not answered"/etc.),
    // falling back to zero talk-time. Re-polled rows (!isNew) never re-notify.
    // Best-effort — never break ingestion.
    if (isNew && call.direction === 'inbound' && call.missed) {
      try {
        await emitEvent({
          companyId: opts.companyId,
          eventKey: 'call.missed',
          title: `Missed call from ${call.caller_number ?? 'withheld number'}`,
          linkUrl: jobId ? `/dashboard/jobs/${jobId}` : '/dashboard/calls',
          relatedEntityType: jobId ? 'job' : null,
          relatedEntityId: jobId,
          priority: 'high',
        });
        result.missedNotified += 1;
      } catch {
        // swallow — notifications never block ingestion
      }
    }
  }

  return result;
}

async function loadSeenExternalIds(
  supabase: AnyClient,
  companyId: string,
  externalIds: string[],
): Promise<Set<string>> {
  if (externalIds.length === 0) return new Set();
  const { data } = await supabase
    .from('phone_calls')
    .select('external_id')
    .eq('company_id', companyId)
    .eq('source', 'tamar_api')
    .in('external_id', externalIds);
  return new Set(((data ?? []) as Array<{ external_id: string | null }>).map((r) => r.external_id ?? ''));
}
