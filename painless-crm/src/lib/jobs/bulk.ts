// Jobs list §bulk-edit — shared bound + a pure id normaliser used by the bulk
// server actions. Keeping the dedup/cap here makes it testable and keeps the
// actions thin.

export const BULK_JOB_LIMIT = 200;

// Trim, drop blanks, de-duplicate. The Zod schema enforces uuid shape + the cap
// afterwards; this just cleans the raw FormData values.
export function normalizeJobIds(raw: readonly string[]): string[] {
  const seen = new Set<string>();
  for (const value of raw) {
    const id = value.trim();
    if (id) seen.add(id);
  }
  return [...seen];
}
