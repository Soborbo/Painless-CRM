import { splitName } from '@/lib/jobs/intake';
import { emitEvent } from '@/lib/notifications/emit';
import type { createAdminClient } from '@/lib/supabase/admin';
import type { MappedEmail } from './parse';

// Ingests parsed Gmail messages into `email_messages` (source='gmail'). Runs
// without a user (service-role) from the poll cron. Each inbound message is
// matched to a customer by from-address (case-insensitive primary_email); an
// unmatched inbound message creates a lightweight contact. Rows upsert on the
// (company_id, gmail_msg_id) unique index so re-polling never duplicates, and a
// "seen" set makes the timeline note + email.received notification fire once.
// Mirrors tamar/ingest.ts. Painless-specific (Supabase) — not part of the
// portable core.

type AnyClient = ReturnType<typeof createAdminClient>;

export interface GmailIngestResult {
  mapped: number;
  skipped: number;
  upserted: number;
  matchedCustomer: number;
  createdCustomer: number;
  notified: number;
}

const SYNC_TABLE = 'email_sync_state';
const MSG_TABLE = 'email_messages';

/** Read the stored history cursor for (company, mailbox), or null on first run. */
export async function readSyncCursor(
  supabase: AnyClient,
  companyId: string,
  mailbox: string,
): Promise<string | null> {
  const { data } = await supabase
    .from(SYNC_TABLE)
    .select('history_id')
    .eq('company_id', companyId)
    .eq('mailbox', mailbox)
    .maybeSingle();
  return (data?.history_id as string | undefined) ?? null;
}

/** Upsert the history cursor + last-synced stamp for (company, mailbox). */
export async function writeSyncCursor(
  supabase: AnyClient,
  companyId: string,
  mailbox: string,
  historyId: string,
  syncedAt: Date,
): Promise<void> {
  await supabase.from(SYNC_TABLE).upsert(
    {
      company_id: companyId,
      mailbox,
      history_id: historyId,
      last_synced_at: syncedAt.toISOString(),
    },
    { onConflict: 'company_id,mailbox' },
  );
}

async function loadSeenMsgIds(
  supabase: AnyClient,
  companyId: string,
  ids: string[],
): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const { data } = await supabase
    .from(MSG_TABLE)
    .select('gmail_msg_id')
    .eq('company_id', companyId)
    .in('gmail_msg_id', ids);
  return new Set(
    ((data ?? []) as Array<{ gmail_msg_id: string | null }>).map((r) => r.gmail_msg_id ?? ''),
  );
}

async function findCustomerIdByEmail(
  supabase: AnyClient,
  companyId: string,
  email: string,
): Promise<string | null> {
  // ilike with no wildcards is a case-insensitive exact match.
  const { data } = await supabase
    .from('customers')
    .select('id')
    .eq('company_id', companyId)
    .is('deleted_at', null)
    .ilike('primary_email', email)
    .limit(1);
  return (data?.[0]?.id as string | undefined) ?? null;
}

async function createContact(
  supabase: AnyClient,
  companyId: string,
  email: MappedEmail,
): Promise<string | null> {
  const { first, last } = splitName(email.from_name ?? email.from_email ?? '');
  const { data, error } = await supabase
    .from('customers')
    .insert({
      company_id: companyId,
      customer_type: 'individual',
      first_name: first,
      last_name: last,
      primary_email: email.from_email,
      acquisition_source: 'other',
      first_contact_at: email.internal_date,
    })
    .select('id')
    .single();
  if (error || !data) return null;
  return data.id as string;
}

function noteBody(email: MappedEmail): string {
  const subject = email.subject?.trim() || '(no subject)';
  const summary = email.snippet?.trim() || email.body_text?.trim() || '';
  const head = `Inbound email — ${subject}`;
  return summary ? `${head}\n\n${summary}`.slice(0, 2000) : head;
}

export async function ingestGmailMessages(
  supabase: AnyClient,
  opts: { companyId: string; mailbox: string; messages: MappedEmail[] },
): Promise<GmailIngestResult> {
  const result: GmailIngestResult = {
    mapped: opts.messages.length,
    skipped: 0,
    upserted: 0,
    matchedCustomer: 0,
    createdCustomer: 0,
    notified: 0,
  };

  const seen = await loadSeenMsgIds(
    supabase,
    opts.companyId,
    opts.messages.map((m) => m.gmail_msg_id),
  );

  for (const email of opts.messages) {
    // Already ingested? The unique index makes the row idempotent; this set
    // makes the note + notification idempotent. Skip the work entirely.
    if (seen.has(email.gmail_msg_id)) {
      result.skipped += 1;
      continue;
    }

    let customerId = email.from_email
      ? await findCustomerIdByEmail(supabase, opts.companyId, email.from_email)
      : null;
    if (customerId) {
      result.matchedCustomer += 1;
    } else if (email.direction === 'inbound' && email.from_email) {
      customerId = await createContact(supabase, opts.companyId, email);
      if (customerId) result.createdCustomer += 1;
    }

    const { error } = await supabase.from(MSG_TABLE).upsert(
      {
        company_id: opts.companyId,
        customer_id: customerId,
        direction: email.direction,
        gmail_msg_id: email.gmail_msg_id,
        thread_id: email.thread_id,
        message_id_hdr: email.message_id_hdr,
        in_reply_to: email.in_reply_to,
        from_email: email.from_email,
        from_name: email.from_name,
        to_email: email.to_email,
        subject: email.subject,
        snippet: email.snippet,
        body_text: email.body_text,
        internal_date: email.internal_date,
        source: 'gmail',
      },
      { onConflict: 'company_id,gmail_msg_id', ignoreDuplicates: true },
    );
    if (error) continue;
    result.upserted += 1;

    // Timeline note on the matched/created customer (best-effort).
    if (customerId) {
      try {
        await supabase.from('notes').insert({
          company_id: opts.companyId,
          parent_type: 'customer',
          parent_id: customerId,
          category: 'admin',
          body: noteBody(email),
        });
      } catch {
        // never block ingestion on a note write
      }
    }

    // Notify subscribers of a genuinely-new inbound email (ADR-044). Re-polled
    // rows never re-notify (the `seen` skip above). Best-effort.
    if (email.direction === 'inbound') {
      try {
        const sender = email.from_name ?? email.from_email ?? 'unknown sender';
        await emitEvent({
          companyId: opts.companyId,
          eventKey: 'email.received',
          title: `New email from ${sender}`,
          body: email.subject,
          linkUrl: customerId ? `/dashboard/customers/${customerId}` : null,
          relatedEntityType: customerId ? 'customer' : null,
          relatedEntityId: customerId,
          priority: 'normal',
        });
        result.notified += 1;
      } catch {
        // swallow — notifications never block ingestion
      }
    }
  }

  return result;
}
