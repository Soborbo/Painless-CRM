// Phase 16 §5 — SLA performance analytics. Pure aggregation over the lead
// cohort's first-response timestamps: overall on-time / breach rates + average
// response time, and a per-rep leaderboard. The Supabase read lives in
// lib/queries/sla-performance.ts.
//
// Only leads that were given an SLA (first_response_due_at set) count. A lead
// is on-time if it was answered by its deadline, breached if answered late or
// still unanswered past the deadline, and pending if unanswered but not yet due
// (excluded from the breach rate — the clock hasn't run out).

export interface SlaJobRow {
  enquiry_at: string | null;
  first_response_due_at: string | null;
  first_response_at: string | null;
  assigned_to_id: string | null;
  assigned_to_name: string | null;
}

export interface SlaMetrics {
  /** Leads with an SLA deadline. */
  total: number;
  responded: number;
  onTime: number;
  breached: number;
  /** Unanswered but not yet past the deadline. */
  pending: number;
  /** breached / (total − pending), 0–100, or null when nothing is decided. */
  breachPct: number | null;
  /** Mean minutes from enquiry to first response over responded leads, or null. */
  avgResponseMins: number | null;
}

export interface SlaRepRow extends SlaMetrics {
  repId: string;
  repName: string;
}

const MIN_MS = 60_000;

interface Acc {
  total: number;
  responded: number;
  onTime: number;
  breached: number;
  pending: number;
  responseMinsSum: number;
}

function emptyAcc(): Acc {
  return { total: 0, responded: 0, onTime: 0, breached: 0, pending: 0, responseMinsSum: 0 };
}

function classify(row: SlaJobRow, acc: Acc, nowMs: number): void {
  const due = row.first_response_due_at;
  if (!due) return; // no SLA on this lead
  acc.total += 1;
  const dueMs = new Date(due).getTime();
  if (row.first_response_at) {
    acc.responded += 1;
    const respMs = new Date(row.first_response_at).getTime();
    if (respMs <= dueMs) acc.onTime += 1;
    else acc.breached += 1;
    if (row.enquiry_at) {
      acc.responseMinsSum += Math.max(0, (respMs - new Date(row.enquiry_at).getTime()) / MIN_MS);
    }
  } else if (nowMs > dueMs) {
    acc.breached += 1;
  } else {
    acc.pending += 1;
  }
}

function finalize(acc: Acc): SlaMetrics {
  const decided = acc.total - acc.pending;
  return {
    total: acc.total,
    responded: acc.responded,
    onTime: acc.onTime,
    breached: acc.breached,
    pending: acc.pending,
    breachPct: decided > 0 ? (acc.breached / decided) * 100 : null,
    avgResponseMins: acc.responded > 0 ? Math.round(acc.responseMinsSum / acc.responded) : null,
  };
}

export interface SlaPerformance {
  overall: SlaMetrics;
  byRep: SlaRepRow[];
}

const UNASSIGNED = '__unassigned__';

export function buildSlaPerformance(rows: readonly SlaJobRow[], now: Date): SlaPerformance {
  const nowMs = now.getTime();
  const overall = emptyAcc();
  const reps = new Map<string, { name: string; acc: Acc }>();

  for (const row of rows) {
    if (!row.first_response_due_at) continue;
    classify(row, overall, nowMs);
    const repId = row.assigned_to_id ?? UNASSIGNED;
    let rep = reps.get(repId);
    if (!rep) {
      rep = { name: row.assigned_to_name ?? 'Unassigned', acc: emptyAcc() };
      reps.set(repId, rep);
    }
    classify(row, rep.acc, nowMs);
  }

  const byRep: SlaRepRow[] = [...reps.entries()].map(([repId, { name, acc }]) => ({
    repId,
    repName: name,
    ...finalize(acc),
  }));
  // Best on-time first (nulls last), then by volume.
  byRep.sort((a, b) => {
    const ao = a.total - a.pending > 0 ? a.onTime / (a.total - a.pending) : -1;
    const bo = b.total - b.pending > 0 ? b.onTime / (b.total - b.pending) : -1;
    return bo - ao || b.total - a.total;
  });

  return { overall: finalize(overall), byRep };
}
