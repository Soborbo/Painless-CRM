import type { MessageRow } from '@/lib/messages/thread';
import { createClient } from '@/lib/supabase/server';
import { customerDisplayName } from '@/lib/utils/format';

// Phase 23 — read-only inbox reads. RLS scopes to the company. The `messages`
// table has no soft-delete column, so no deleted_at filter.

const COLUMNS = `
  id, thread_id, customer_id, job_id, channel, direction, subject, body, sent_at,
  from_address, to_address,
  customer:customers!messages_customer_id_fkey (customer_type, first_name, last_name, company_name, primary_email)
`;

function flatten(raw: Record<string, unknown>): MessageRow {
  const c = raw.customer;
  const customer = Array.isArray(c)
    ? (c[0] as Parameters<typeof customerDisplayName>[0] | undefined)
    : (c as Parameters<typeof customerDisplayName>[0] | null);
  return {
    id: raw.id as string,
    thread_id: (raw.thread_id as string | null) ?? null,
    customer_id: (raw.customer_id as string | null) ?? null,
    customer_name: customer ? customerDisplayName(customer) : null,
    job_id: (raw.job_id as string | null) ?? null,
    channel: (raw.channel as string | null) ?? null,
    direction: (raw.direction as string | null) ?? null,
    subject: (raw.subject as string | null) ?? null,
    body: (raw.body as string | null) ?? '',
    sent_at: (raw.sent_at as string | null) ?? null,
    from_address: (raw.from_address as string | null) ?? null,
    to_address: (raw.to_address as string | null) ?? null,
  };
}

const INBOX_CAP = 500;

export async function listRecentMessages(): Promise<MessageRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('messages')
    .select(COLUMNS)
    .order('sent_at', { ascending: false })
    .limit(INBOX_CAP);
  return ((data ?? []) as Array<Record<string, unknown>>).map(flatten);
}

export interface ThreadDetail {
  messages: MessageRow[];
  anchor: MessageRow;
}

// The full thread a given message belongs to: siblings sharing its thread_id,
// or just the message itself when it is unthreaded.
export async function getThreadForMessage(messageId: string): Promise<ThreadDetail | null> {
  const supabase = await createClient();
  const { data: anchorRaw } = await supabase
    .from('messages')
    .select(COLUMNS)
    .eq('id', messageId)
    .maybeSingle();
  if (!anchorRaw) return null;
  const anchor = flatten(anchorRaw as Record<string, unknown>);

  if (!anchor.thread_id) return { messages: [anchor], anchor };

  const { data } = await supabase
    .from('messages')
    .select(COLUMNS)
    .eq('thread_id', anchor.thread_id)
    .order('sent_at', { ascending: true })
    .limit(INBOX_CAP);
  const messages = ((data ?? []) as Array<Record<string, unknown>>).map(flatten);
  return { messages: messages.length > 0 ? messages : [anchor], anchor };
}
