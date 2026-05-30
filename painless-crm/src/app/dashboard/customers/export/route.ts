import { requireRole } from '@/lib/auth/require-role';
import { recordExport } from '@/lib/exports/audit';
import { customersExportFilename, serializeCustomersToCsv } from '@/lib/exports/customers-csv';
import { enforceExportRateLimit } from '@/lib/exports/guard';
import { listCustomersForExport } from '@/lib/queries/customers';
import { CustomerListFiltersSchema } from '@/lib/schemas/customer';
import { type NextRequest, NextResponse } from 'next/server';

// Phase 06b §8 — accountant-friendly CSV of the customers list. Reuses the
// same filter parsing as the screen so "what you see is what you export".
// RLS scopes the read to the caller's company.

const EXPORT_ROLES = ['sales', 'manager', 'admin', 'accounts', 'super_admin'] as const;

export async function GET(request: NextRequest): Promise<Response> {
  const user = await requireRole(EXPORT_ROLES);

  const limited = await enforceExportRateLimit(user.id, 'customers');
  if (limited) return limited;

  const url = new URL(request.url);
  const parsed = CustomerListFiltersSchema.safeParse({
    q: url.searchParams.get('q') ?? undefined,
    type: url.searchParams.get('type') ?? undefined,
    page: undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_filters' }, { status: 400 });
  }

  const rows = await listCustomersForExport({
    q: parsed.data.q,
    type: parsed.data.type,
  });
  const csv = serializeCustomersToCsv(rows);
  const filename = customersExportFilename();

  await recordExport({
    companyId: user.company_id,
    userId: user.id,
    resource: 'customers',
    filters: { q: parsed.data.q, type: parsed.data.type },
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
