// Phase 06b §3 — keyboard navigation backing logic for the global search
// popover. Pure functions so the flattening + highlight stepping rules are
// unit-testable without a DOM; the component owns the focus/keydown wiring.

import type { GlobalSearchResults } from '@/lib/queries/global-search';

// A search hit reduced to what keyboard navigation needs: a stable identity
// (for React keys + matching the highlighted row) and the page to open on
// Enter. The popover renders customers → jobs → quotes, so the flattened
// order mirrors that grouping exactly.
export interface FlatHit {
  key: string;
  href: string;
}

export function buildFlatHits(results: GlobalSearchResults): FlatHit[] {
  const hits: FlatHit[] = [];
  for (const c of results.customers) {
    hits.push({ key: `customer:${c.id}`, href: `/dashboard/customers/${c.id}` });
  }
  for (const j of results.jobs) {
    hits.push({ key: `job:${j.id}`, href: `/dashboard/jobs/${j.id}` });
  }
  for (const q of results.quotes) {
    hits.push({ key: `quote:${q.id}`, href: `/dashboard/jobs/${q.job_id}/quote/${q.id}` });
  }
  return hits;
}

// Steps the highlighted index by `delta` (+1 for ArrowDown, -1 for ArrowUp)
// and clamps into [0, count - 1] — no wrap-around, so pressing Up at the top
// or Down at the bottom is a no-op rather than jumping to the far end. With
// no hits the index collapses to -1 ("nothing highlighted").
export function moveHighlight(current: number, count: number, delta: number): number {
  if (count <= 0) return -1;
  const next = current + delta;
  if (next < 0) return 0;
  if (next > count - 1) return count - 1;
  return next;
}
