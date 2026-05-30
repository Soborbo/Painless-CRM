import { requireRole } from '@/lib/auth/require-role';
import { auditContextFromHeaders, recordExport } from '@/lib/exports/audit';
import { enforceExportRateLimit } from '@/lib/exports/guard';
import { profitExportFilename, serializeProfitToCsv } from '@/lib/exports/profit-csv';
import { type ProfitRange, resolveRange } from '@/lib/jobs/profit-dashboard';
import { listProfitDashboardJobs } from '@/lib/queries/profit-dashboard';
import type { NextRequest } from 'next/server';

// Phase 06b §8 + §2b — accountant-friendly CSV of the profit dashboard.
// Mirrors the page's range selection so the file matches the screen, and
// reuses the same role gate. RLS scopes the reads to the caller's company.

const REVIEW_ROLES = ['manager', 'admin', 'super_admin'] as const;
const VALID_RANGES = ['month', 'quarter'] as const satisfies readonly ProfitRange[];

function parseRange(value: string | null): ProfitRange {
  return (VALID_RANGES as readonly string[]).includes(value ?? '')
    ? (value as ProfitRange)
    : 'month';
}

export async function GET(request: NextRequest): Promise<Response> {
  const user = await requireRole(REVIEW_ROLES);

  const limited = await enforceExportRateLimit(user.id, 'profit');
  if (limited) return limited;

  const url = new URL(request.url);
  const range = parseRange(url.searchParams.get('range'));
  const window = resolveRange(range, new Date());

  const rows = await listProfitDashboardJobs(window);
  const csv = serializeProfitToCsv(rows);
  const filename = profitExportFilename();

  await recordExport({
    companyId: user.company_id,
    userId: user.id,
    resource: 'profit',
    filters: { range },
    rowCount: rows.length,
    ...auditContextFromHeaders(request.headers),
  });

  return new Response(csv, {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'no-store',
    },
  });
}

export const runtime = 'nodejs';
