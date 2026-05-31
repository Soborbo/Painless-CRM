// Phase 06b §3 — "recent searches" backing logic for the global search bar.
// Pure functions so the dedupe/cap rules are unit-testable without a DOM;
// the component owns the localStorage read/write around them.

export const RECENT_SEARCHES_KEY = 'painless.recentSearches';
export const MAX_RECENT_SEARCHES = 5;

// Prepends `term` to the recent list: trims it, drops a case-insensitive
// duplicate of the same term (so re-searching just bumps it to the top),
// and caps the list at MAX_RECENT_SEARCHES. A blank term is a no-op.
export function addRecentSearch(list: readonly string[], term: string): string[] {
  const trimmed = term.trim();
  if (trimmed === '') return [...list];
  const withoutDupe = list.filter((entry) => entry.toLowerCase() !== trimmed.toLowerCase());
  return [trimmed, ...withoutDupe].slice(0, MAX_RECENT_SEARCHES);
}

// Normalises whatever came back from localStorage into a clean string list:
// tolerates non-arrays / non-string entries, trims, drops blanks and
// case-insensitive duplicates, and caps the length.
export function parseRecentSearches(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    if (typeof entry !== 'string') continue;
    const trimmed = entry.trim();
    if (trimmed === '') continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
    if (out.length >= MAX_RECENT_SEARCHES) break;
  }
  return out;
}
