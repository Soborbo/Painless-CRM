import { requireRole } from '@/lib/auth/require-role';
import { recordExport } from '@/lib/exports/audit';
import { enforceExportRateLimit } from '@/lib/exports/guard';
import { exportFilename, serializeJobsToCsv } from '@/lib/exports/jobs-csv';
import { listJobsForExport } from '@/lib/queries/jobs';
import { JobListFiltersSchema } from '@/lib/schemas/job';
import { type NextRequest, NextResponse } from 'next/server';

// Phase 06b §8 — accountant-friendly CSV of the jobs list. Reuses the
// same filter parsing as the screen so "what you see is what you export".
// RLS scopes the read to the caller's company.

const EXPORT_ROLES = ['sales', 'manager', 'admin', 'accounts', 'super_admin'] as const;

export async function GET(request: NextRequest): Promise<Response> {
  const user = await requireRole(EXPORT_ROLES);

  const limited = await enforceExportRateLimit(user.id, 'jobs');
  if (limited) return limited;

  const url = new URL(request.url);
  const parsed = JobListFiltersSchema.safeParse({
    q: url.searchParams.get('q') ?? undefined,
    stage: url.searchParams.get('stage') ?? undefined,
    assigned_to_id: url.searchParams.get('assigned_to_id') ?? undefined,
    page: undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_filters' }, { status: 400 });
  }

  const rows = await listJobsForExport({
    q: parsed.data.q,
    stage: parsed.data.stage,
    assigned_to_id: parsed.data.assigned_to_id,
  });
  const csv = serializeJobsToCsv(rows);
  const filename = exportFilename();

  await recordExport({
    companyId: user.company_id,
    userId: user.id,
    resource: 'jobs',
    filters: {
      q: parsed.data.q,
      stage: parsed.data.stage,
      assigned_to_id: parsed.data.assigned_to_id,
    },
    rowCount: rows.length,
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
