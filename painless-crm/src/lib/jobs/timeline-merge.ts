import type { JobStage } from '@/lib/jobs/state-machine';

// Pure merger for the per-job timeline (Phase 06b §5). Sources arrive as
// loosely-typed rows from their respective tables; this module normalises
// them into a discriminated union and sorts strictly newest-first by the
// canonical `at` timestamp. The merge is intentionally lossy — fields not
// shown on the timeline don't survive the conversion, so the union stays
// small and the renderer is dumb.

export type TimelineEvent =
  | {
      kind: 'stage';
      at: string;
      from: JobStage | null;
      to: JobStage;
      reason: string | null;
      actor: string | null;
    }
  | {
      kind: 'note';
      at: string;
      body: string;
      is_customer_visible: boolean;
      actor: string | null;
    }
  | {
      kind: 'call';
      at: string;
      direction: 'inbound' | 'outbound' | null;
      duration_seconds: number | null;
      outcome: string | null;
      actor: string | null;
    }
  | {
      kind: 'quote_created';
      at: string;
      quote_id: string;
      total_pence: number;
    }
  | {
      kind: 'quote_sent';
      at: string;
      quote_id: string;
    }
  | {
      kind: 'quote_accepted';
      at: string;
      quote_id: string;
      acceptor_name: string | null;
      variant_label: string | null;
    }
  | {
      kind: 'quote_opened';
      at: string;
      quote_id: string;
      open_count: number;
    }
  | {
      kind: 'quote_declined';
      at: string;
      quote_id: string;
      reason: string | null;
    }
  | {
      kind: 'quote_withdrawn';
      at: string;
      quote_id: string;
      reason: string | null;
      actor: string | null;
    };

export interface StageHistoryRow {
  changed_at: string;
  from_stage: JobStage | null;
  to_stage: JobStage;
  reason: string | null;
  changed_by: { full_name: string } | null;
}

export interface NoteHistoryRow {
  created_at: string;
  body: string;
  is_customer_visible: boolean;
  created_by: { full_name: string } | null;
}

export interface CallHistoryRow {
  occurred_at: string;
  direction: 'inbound' | 'outbound' | null;
  duration_seconds: number | null;
  outcome: string | null;
  user: { full_name: string } | null;
}

export interface QuoteHistoryRow {
  id: string;
  created_at: string;
  sent_at: string | null;
  total_pence: number;
  status: 'draft' | 'sent' | 'accepted' | 'declined' | 'expired' | null;
  first_opened_at: string | null;
  open_count: number | null;
  declined_at: string | null;
  decline_reason: string | null;
  withdrawn_at: string | null;
  withdrawal_reason: string | null;
  withdrawn_by: { full_name: string } | null;
}

export interface QuoteAcceptanceHistoryRow {
  quote_id: string;
  accepted_at: string;
  consents: { accepted_full_name?: string | null } | null;
  variant: { variant_label: string } | null;
}

export interface TimelineSources {
  stages: StageHistoryRow[];
  notes: NoteHistoryRow[];
  calls: CallHistoryRow[];
  quotes: QuoteHistoryRow[];
  acceptances: QuoteAcceptanceHistoryRow[];
}

export function mergeJobTimeline(sources: TimelineSources): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  for (const stage of sources.stages) {
    events.push({
      kind: 'stage',
      at: stage.changed_at,
      from: stage.from_stage,
      to: stage.to_stage,
      reason: stage.reason,
      actor: stage.changed_by?.full_name ?? null,
    });
  }

  for (const note of sources.notes) {
    events.push({
      kind: 'note',
      at: note.created_at,
      body: note.body,
      is_customer_visible: note.is_customer_visible,
      actor: note.created_by?.full_name ?? null,
    });
  }

  for (const call of sources.calls) {
    events.push({
      kind: 'call',
      at: call.occurred_at,
      direction: call.direction,
      duration_seconds: call.duration_seconds,
      outcome: call.outcome,
      actor: call.user?.full_name ?? null,
    });
  }

  for (const quote of sources.quotes) {
    events.push({
      kind: 'quote_created',
      at: quote.created_at,
      quote_id: quote.id,
      total_pence: quote.total_pence,
    });
    if (quote.sent_at) {
      events.push({ kind: 'quote_sent', at: quote.sent_at, quote_id: quote.id });
    }
    if (quote.first_opened_at) {
      events.push({
        kind: 'quote_opened',
        at: quote.first_opened_at,
        quote_id: quote.id,
        open_count: quote.open_count ?? 1,
      });
    }
    if (quote.declined_at) {
      events.push({
        kind: 'quote_declined',
        at: quote.declined_at,
        quote_id: quote.id,
        reason: quote.decline_reason,
      });
    }
    if (quote.withdrawn_at) {
      events.push({
        kind: 'quote_withdrawn',
        at: quote.withdrawn_at,
        quote_id: quote.id,
        reason: quote.withdrawal_reason,
        actor: quote.withdrawn_by?.full_name ?? null,
      });
    }
  }

  for (const acceptance of sources.acceptances) {
    events.push({
      kind: 'quote_accepted',
      at: acceptance.accepted_at,
      quote_id: acceptance.quote_id,
      acceptor_name: acceptance.consents?.accepted_full_name ?? null,
      variant_label: acceptance.variant?.variant_label ?? null,
    });
  }

  events.sort((a, b) => {
    const at = Date.parse(b.at) - Date.parse(a.at);
    if (at !== 0) return at;
    return rankKind(b.kind) - rankKind(a.kind);
  });
  return events;
}

// Stable secondary order when two events share a timestamp (e.g. acceptance
// and the stage transition that the acceptance triggered land in the same
// transaction). Higher rank shows first when timestamps tie.
function rankKind(kind: TimelineEvent['kind']): number {
  switch (kind) {
    case 'stage':
      return 8;
    case 'quote_accepted':
      return 7;
    case 'quote_declined':
      return 6;
    case 'quote_withdrawn':
      return 5;
    case 'quote_opened':
      return 4;
    case 'quote_sent':
      return 3;
    case 'quote_created':
      return 2;
    case 'note':
      return 1;
    case 'call':
      return 0;
  }
}
