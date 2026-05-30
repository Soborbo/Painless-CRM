// Export audit logging. Phase 06b §8 / ADR-021.
//
// SECURITY_MODEL.md T4 wants every bulk export recorded with a row count so a
// departing rep's exfiltration leaves a trail. Writes go to the dedicated
// `data_export_log` table (not `activity_log`, which is trigger-only and
// rejects app-role inserts — see migration 00000000000035). The write is
// best-effort: an audit failure must never deny a legitimate export, so it is
// swallowed and the CSV still streams.

import type { TablesInsert } from '@/lib/database.types';
import type { ExportResource } from '@/lib/exports/guard';
import { pickClientIp } from '@/lib/quotes/public-acceptance';
import { createClient } from '@/lib/supabase/server';

export interface ExportAuditInput {
  companyId: string;
  userId: string;
  resource: ExportResource;
  filters: Record<string, unknown>;
  rowCount: number;
  format?: 'csv' | 'xlsx';
  /** Client IP, already extracted via pickClientIp (or null if unknown). */
  ipAddress?: string | null;
  userAgent?: string | null;
}

const USER_AGENT_MAX = 500;

// Pure shaping of the audit row. Drops null/undefined filter values so the
// stored JSON reflects only the filters the user actually applied, and only
// attaches IP / user-agent when present so the inet column never sees ''.
export function buildExportAuditRow(input: ExportAuditInput): TablesInsert<'data_export_log'> {
  const filters: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input.filters)) {
    if (value !== null && value !== undefined && value !== '') filters[key] = value;
  }
  const row: TablesInsert<'data_export_log'> = {
    company_id: input.companyId,
    exported_by_id: input.userId,
    resource: input.resource,
    format: input.format ?? 'csv',
    filters: filters as TablesInsert<'data_export_log'>['filters'],
    row_count: input.rowCount,
  };
  if (input.ipAddress) row.ip_address = input.ipAddress;
  if (input.userAgent) row.user_agent = input.userAgent.slice(0, USER_AGENT_MAX);
  return row;
}

// Extracts the IP / user-agent an audit row wants from the request headers,
// reusing the same IP-header precedence as the public quote-acceptance audit.
export function auditContextFromHeaders(headers: Headers): {
  ipAddress: string | null;
  userAgent: string | null;
} {
  return { ipAddress: pickClientIp(headers), userAgent: headers.get('user-agent') };
}

export async function recordExport(input: ExportAuditInput): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.from('data_export_log').insert(buildExportAuditRow(input));
  } catch {
    // Best-effort: never block the export on an audit write failure.
  }
}
