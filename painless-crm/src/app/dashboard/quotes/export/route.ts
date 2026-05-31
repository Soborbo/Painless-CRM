import { requireRole } from '@/lib/auth/require-role';
import { auditContextFromHeaders, recordExport } from '@/lib/exports/audit';
import { enforceExportRateLimit } from '@/lib/exports/guard';
import { quotesExportFilename, serializeQuotesToCsv } from '@/lib/exports/quotes-csv';
import { listQuotesForExport } from '@/lib/queries/quotes';
import { QuoteListFiltersSchema } from '@/lib/schemas/quote';
import { type NextRequest, NextResponse } from 'next/server';

// Phase 06b §8 — accountant-friendly CSV of the office-wide quotes list.
// Reuses the same filter parsing as the screen so "what you see is what you
// export". RLS scopes the read to the caller's company.

const EXPORT_ROLES = ['sales', 'manager', 'admin', 'accounts', 'super_admin'] as const;

export async function GET(request: NextRequest): Promise<Response> {
  const user = await requireRole(EXPORT_ROLES);

  const limited = await enforceExportRateLimit(user.id, 'quotes');
  if (limited) return limited;

  const url = new URL(request.url);
  const parsed = QuoteListFiltersSchema.safeParse({
    status: url.searchParams.get('status') ?? undefined,
    page: undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_filters' }, { status: 400 });
  }

  const rows = await listQuotesForExport({ status: parsed.data.status });
  const csv = serializeQuotesToCsv(rows);
  const filename = quotesExportFilename();

  await recordExport({
    companyId: user.company_id,
    userId: user.id,
    resource: 'quotes',
    filters: { status: parsed.data.status },
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
