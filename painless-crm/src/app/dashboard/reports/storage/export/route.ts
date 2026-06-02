import { requireRole } from '@/lib/auth/require-role';
import { auditContextFromHeaders, recordExport } from '@/lib/exports/audit';
import { enforceExportRateLimit } from '@/lib/exports/guard';
import { reportExportFilename, serializeStorageToCsv } from '@/lib/exports/reports-csv';
import { type ProfitRange, resolveRange } from '@/lib/jobs/profit-dashboard';
import { listRentalsForReport } from '@/lib/queries/storage-rental';
import { buildStorageReport } from '@/lib/reports/storage';
import type { NextRequest } from 'next/server';

// Phase 14 — CSV of the storage performance KPIs (MRR/churn/movement).
// Mirrors the page's range for the movement metrics; RLS scopes the read.

const REPORT_ROLES = ['manager', 'admin', 'super_admin'] as const;
const VALID_RANGES = ['month', 'quarter'] as const satisfies readonly ProfitRange[];

function parseRange(value: string | null): ProfitRange {
  return (VALID_RANGES as readonly string[]).includes(value ?? '')
    ? (value as ProfitRange)
    : 'month';
}

export async function GET(request: NextRequest): Promise<Response> {
  const user = await requireRole(REPORT_ROLES);

  const limited = await enforceExportRateLimit(user.id, 'report_storage');
  if (limited) return limited;

  const url = new URL(request.url);
  const range = parseRange(url.searchParams.get('range'));
  const window = resolveRange(range, new Date());

  const rentals = await listRentalsForReport();
  const report = buildStorageReport(rentals, window);
  const csv = serializeStorageToCsv(report);

  await recordExport({
    companyId: user.company_id,
    userId: user.id,
    resource: 'report_storage',
    filters: { range },
    rowCount: report.activeRentals + report.pendingRentals,
    ...auditContextFromHeaders(request.headers),
  });

  return new Response(csv, {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${reportExportFilename('storage')}"`,
      'cache-control': 'no-store',
    },
  });
}

export const runtime = 'nodejs';
