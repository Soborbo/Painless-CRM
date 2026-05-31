import { createClient } from '@/lib/supabase/server';

// Export-audit read surface (Phase 06b §8 follow-up / ADR-021, SECURITY_MODEL
// T4). The `data_export_log` table records every bulk export — who pulled
// which resource, with what filters, how many rows — but until now had no read
// surface, so the trail was write-only. This lists the tenant's recent exports
// for the admin "Security → Exports" page. RLS scopes the read to the caller's
// company; rows are immutable (no app-role update/delete), so the history shown
// here cannot have been rewritten.

const EXPORT_LOG_LIMIT = 200;

export interface ExportLogRow {
  id: number;
  exported_at: string;
  resource: string;
  format: string;
  row_count: number;
  ip_address: string | null;
  actor_name: string | null;
  actor_email: string | null;
  filters: Record<string, unknown>;
}

const EXPORT_LOG_COLUMNS = `
  id, exported_at, resource, format, row_count, ip_address,
  actor:users!data_export_log_exported_by_id_fkey (full_name, email)
`;

function embedOne<T>(raw: unknown): T | null {
  if (Array.isArray(raw)) return (raw[0] as T | undefined) ?? null;
  return (raw as T | null) ?? null;
}

// Compact, deterministic one-line summary of the applied filters for display
// (e.g. "from: 2026-01-01 · search: smith"). Skips empty values and sorts keys
// so the same filter set always renders identically. Pure — unit-tested.
export function summarizeFilters(filters: unknown): string {
  if (!filters || typeof filters !== 'object' || Array.isArray(filters)) return '';
  return Object.entries(filters as Record<string, unknown>)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(' · ');
}

// Pure flatten — exported so the PostgREST embed-shape normalisation (actor
// arriving as an object or a single-element array) is unit-testable without a
// live Supabase connection. inet comes back as a string; coerce defensively.
export function flattenExportLogRow(raw: Record<string, unknown>): ExportLogRow {
  const actor = embedOne<{ full_name?: string | null; email?: string | null }>(raw.actor);
  const filters = raw.filters;
  return {
    id: raw.id as number,
    exported_at: raw.exported_at as string,
    resource: (raw.resource as string | null) ?? '',
    format: (raw.format as string | null) ?? 'csv',
    row_count: (raw.row_count as number | null) ?? 0,
    ip_address: raw.ip_address ? String(raw.ip_address) : null,
    actor_name: actor?.full_name ?? null,
    actor_email: actor?.email ?? null,
    filters:
      filters && typeof filters === 'object' && !Array.isArray(filters)
        ? (filters as Record<string, unknown>)
        : {},
  };
}

export async function listRecentExports(): Promise<ExportLogRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('data_export_log')
    .select(EXPORT_LOG_COLUMNS)
    .order('exported_at', { ascending: false })
    .limit(EXPORT_LOG_LIMIT);
  return ((data ?? []) as Array<Record<string, unknown>>).map(flattenExportLogRow);
}
