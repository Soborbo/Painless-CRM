// Phase 23 — pure threading for the read-only message inbox. No I/O, so it
// unit-tests directly. Grouping is by thread_id, falling back to the message's
// own id (a singleton) when unthreaded — most stored messages are unthreaded
// outbound sends today; richer per-conversation threading arrives with inbound
// ingestion (infra-gated). See ADR-032.

export interface MessageRow {
  id: string;
  thread_id: string | null;
  customer_id: string | null;
  customer_name: string | null;
  job_id: string | null;
  channel: string | null;
  direction: string | null;
  subject: string | null;
  body: string;
  sent_at: string | null;
  from_address: string | null;
  to_address: string | null;
}

export interface ThreadSummary {
  /** Stable grouping key (thread_id or the singleton message id). */
  key: string;
  /** The latest message's id — the route target for the detail view. */
  routeId: string;
  customerId: string | null;
  customerName: string | null;
  jobId: string | null;
  subject: string | null;
  channel: string | null;
  count: number;
  lastAt: string | null;
  lastDirection: string | null;
  preview: string;
  /** The last message is inbound — the customer is waiting on a reply. */
  needsReply: boolean;
}

export function threadKey(m: MessageRow): string {
  return m.thread_id ?? m.id;
}

function bySentAtAsc(a: MessageRow, b: MessageRow): number {
  return (a.sent_at ?? '').localeCompare(b.sent_at ?? '');
}

// All messages in a thread, oldest first.
export function sortThreadMessages(messages: readonly MessageRow[]): MessageRow[] {
  return [...messages].sort(bySentAtAsc);
}

function preview(body: string): string {
  const flat = body.replace(/\s+/g, ' ').trim();
  return flat.length > 120 ? `${flat.slice(0, 120)}…` : flat;
}

export function groupThreads(messages: readonly MessageRow[]): ThreadSummary[] {
  const groups = new Map<string, MessageRow[]>();
  for (const m of messages) {
    const key = threadKey(m);
    const list = groups.get(key) ?? [];
    list.push(m);
    groups.set(key, list);
  }

  const summaries: ThreadSummary[] = [];
  for (const [key, list] of groups) {
    const ordered = sortThreadMessages(list);
    const last = ordered[ordered.length - 1] as MessageRow;
    const first = ordered[0] as MessageRow;
    summaries.push({
      key,
      routeId: last.id,
      customerId: last.customer_id ?? first.customer_id,
      customerName: last.customer_name ?? first.customer_name,
      jobId: last.job_id ?? first.job_id,
      subject: ordered.find((m) => m.subject)?.subject ?? null,
      channel: last.channel,
      count: ordered.length,
      lastAt: last.sent_at,
      lastDirection: last.direction,
      preview: preview(last.body),
      needsReply: last.direction === 'inbound',
    });
  }

  // Most recent activity first; null timestamps sink to the bottom.
  summaries.sort((a, b) => (b.lastAt ?? '').localeCompare(a.lastAt ?? ''));
  return summaries;
}
