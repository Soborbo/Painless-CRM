import { requireRole } from '@/lib/auth/require-role';
import { auditContextFromHeaders, recordExport } from '@/lib/exports/audit';
import { enforceExportRateLimit } from '@/lib/exports/guard';
import { reportExportFilename, serializeTeamStatsToCsv } from '@/lib/exports/reports-csv';
import { getTeamStats } from '@/lib/queries/team-stats';
import type { NextRequest } from 'next/server';

// CSV of the per-worker performance roll-up. Matches the report page's role gate;
// RLS scopes the read to the company. Internal use only — never customer-facing.

const REPORT_ROLES = ['manager', 'admin', 'super_admin'] as const;

export async function GET(request: NextRequest): Promise<Response> {
  const user = await requireRole(REPORT_ROLES);

  const limited = await enforceExportRateLimit(user.id, 'report_team');
  if (limited) return limited;

  const stats = await getTeamStats();
  const csv = serializeTeamStatsToCsv(stats);

  await recordExport({
    companyId: user.company_id,
    userId: user.id,
    resource: 'report_team',
    filters: {},
    rowCount: stats.length,
    ...auditContextFromHeaders(request.headers),
  });

  return new Response(csv, {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${reportExportFilename('team')}"`,
      'cache-control': 'no-store',
    },
  });
}

export const runtime = 'nodejs';
