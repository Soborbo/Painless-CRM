// Pure, client-safe formatting for export-log rows. Kept separate from
// export-log.ts (which imports the Supabase server client) so client
// components can import this without pulling server-only code into the bundle.

export function summarizeFilters(filters: unknown): string {
  if (!filters || typeof filters !== 'object' || Array.isArray(filters)) return '';
  return Object.entries(filters as Record<string, unknown>)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(' · ');
}
