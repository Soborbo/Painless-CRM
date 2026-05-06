// Picks the "headline" quote to display alongside a job — the one whose total
// is the most authoritative answer to "what's this job worth?". Priority is
// status-first, recency-second:
//
//   accepted (latest)  →  the contract
//   sent (latest)      →  the live offer
//   draft (latest)     →  what sales is working on
//   declined (latest)  →  last interaction (greyed out by the renderer)
//   expired (latest)   →  fallback if nothing else exists
//
// This avoids the bug where `jobs.quote_total_pence` (which the writer last
// stamped during INSERT) reflects the most recent quote regardless of status —
// e.g. a £12k draft revision masking an already-accepted £10k contract.

export interface HeadlineCandidate {
  id: string;
  total_pence: number;
  status: 'draft' | 'sent' | 'accepted' | 'declined' | 'expired' | null;
  created_at: string;
}

const PRIORITY: ReadonlyArray<NonNullable<HeadlineCandidate['status']>> = [
  'accepted',
  'sent',
  'draft',
  'declined',
  'expired',
];

export function pickHeadlineQuote<T extends HeadlineCandidate>(rows: T[]): T | null {
  if (rows.length === 0) return null;
  for (const status of PRIORITY) {
    const matches = rows.filter((r) => r.status === status);
    if (matches.length === 0) continue;
    const sorted = [...matches].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
    return sorted[0] ?? null;
  }
  return null;
}
