import { requireRole } from '@/lib/auth/require-role';
import { getCustomerStatement } from '@/lib/queries/statements';
import { serializeStatementToCsv } from '@/lib/statements/statement-csv';

// Phase 26 — per-customer account statement as CSV. RLS scopes the read.

const ROLES = ['accounts', 'manager', 'admin', 'super_admin'] as const;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  await requireRole(ROLES);
  const { id } = await params;
  const statement = await getCustomerStatement(id);
  const csv = serializeStatementToCsv(statement);

  return new Response(csv, {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="statement-${id}.csv"`,
      'cache-control': 'no-store',
    },
  });
}

export const runtime = 'nodejs';
