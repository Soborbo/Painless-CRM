// Computes price deltas between revisions and their predecessors. Pure helper
// kept off the QuotesPanel render path so the arithmetic stays unit-testable
// — the panel just gets `delta_pence` annotated onto each row and renders.
// The predecessor lookup is by `revised_from_id` against the same list; if a
// chain crosses a soft-delete boundary the delta is null rather than fabricated.

export interface QuoteForDelta {
  id: string;
  total_pence: number;
  revised_from_id: string | null;
}

export interface QuoteWithDelta<T extends QuoteForDelta> {
  row: T;
  delta_pence: number | null;
}

export function computeRevisionDeltas<T extends QuoteForDelta>(rows: T[]): QuoteWithDelta<T>[] {
  const totalById = new Map<string, number>();
  for (const row of rows) totalById.set(row.id, row.total_pence);
  return rows.map((row) => {
    if (!row.revised_from_id) return { row, delta_pence: null };
    const parentTotal = totalById.get(row.revised_from_id);
    if (parentTotal === undefined) return { row, delta_pence: null };
    return { row, delta_pence: row.total_pence - parentTotal };
  });
}
