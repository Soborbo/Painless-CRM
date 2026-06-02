import { requireRole } from '@/lib/auth/require-role';
import { auditContextFromHeaders, recordExport } from '@/lib/exports/audit';
import { enforceExportRateLimit } from '@/lib/exports/guard';
import { reportExportFilename, serializeSourcesToCsv } from '@/lib/exports/reports-csv';
import { type ProfitRange, resolveRange } from '@/lib/jobs/profit-dashboard';
import { listAttributionJobs } from '@/lib/queries/reports';
import { buildSourceAttribution } from '@/lib/reports/attribution';
import type { NextRequest } from 'next/server';

// Phase 14 — CSV of the source-attribution scorecard. Mirrors the page's range
// + role gate; RLS scopes the read to the company.

const REPORT_ROLES = ['manager', 'admin', 'super_admin'] as const;
const VALID_RANGES = ['month', 'quarter'] as const satisfies readonly ProfitRange[];

function parseRange(value: string | null): ProfitRange {
  return (VALID_RANGES as readonly string[]).includes(value ?? '')
    ? (value as ProfitRange)
    : 'month';
}

export async function GET(request: NextRequest): Promise<Response> {
  const user = await requireRole(REPORT_ROLES);

  const limited = await enforceExportRateLimit(user.id, 'report_sources');
  if (limited) return limited;

  const url = new URL(request.url);
  const range = parseRange(url.searchParams.get('range'));
  const window = resolveRange(range, new Date());

  const rows = await listAttributionJobs(window);
  const sources = buildSourceAttribution(rows);
  const csv = serializeSourcesToCsv(sources);

  await recordExport({
    companyId: user.company_id,
    userId: user.id,
    resource: 'report_sources',
    filters: { range },
    rowCount: sources.length,
    ...auditContextFromHeaders(request.headers),
  });

  return new Response(csv, {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${reportExportFilename('sources')}"`,
      'cache-control': 'no-store',
    },
  });
}

export const runtime = 'nodejs';
