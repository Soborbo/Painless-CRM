import { requireRole } from '@/lib/auth/require-role';
import { auditContextFromHeaders, recordExport } from '@/lib/exports/audit';
import { enforceExportRateLimit } from '@/lib/exports/guard';
import { reportExportFilename, serializeArAgingToCsv } from '@/lib/exports/reports-csv';
import { listOutstandingInvoices } from '@/lib/queries/reports';
import { buildArAging } from '@/lib/reports/financial';
import type { NextRequest } from 'next/server';

// Phase 14 — CSV of the accounts-receivable aging snapshot. Aging is
// point-in-time (as of now), so no range param; RLS scopes the read.

const REPORT_ROLES = ['manager', 'admin', 'super_admin'] as const;

export async function GET(request: NextRequest): Promise<Response> {
  const user = await requireRole(REPORT_ROLES);

  const limited = await enforceExportRateLimit(user.id, 'report_financial');
  if (limited) return limited;

  const outstanding = await listOutstandingInvoices();
  const aging = buildArAging(outstanding, new Date().toISOString());
  const csv = serializeArAgingToCsv(aging);

  await recordExport({
    companyId: user.company_id,
    userId: user.id,
    resource: 'report_financial',
    filters: {},
    rowCount: aging.totalCount,
    ...auditContextFromHeaders(request.headers),
  });

  return new Response(csv, {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${reportExportFilename('ar-aging')}"`,
      'cache-control': 'no-store',
    },
  });
}

export const runtime = 'nodejs';
