import { createAdminClient } from '@/lib/supabase/admin';

// Phase 16 §2 — public affiliate (partner) portal read. The affiliate code is
// the access secret (like the quote/feedback token links), so there is no user
// session; reads run on the service-role client and are *manually* scoped to
// the one affiliate the code resolves to. Only that affiliate's own commission
// ledger is exposed — no customer PII, just job numbers, amounts and status.

// Codes are short alphanumerics (e.g. JONNY25, RELISHHQ). Validate before any
// lookup to keep the surface tight.
const CODE_RE = /^[A-Za-z0-9_-]{3,40}$/;

export function isValidPartnerCode(code: string): boolean {
  return CODE_RE.test(code);
}

export interface PartnerCommissionRow {
  id: string;
  amountPence: number;
  status: string;
  jobNumber: number | null;
  createdAt: string;
  paidAt: string | null;
}

export interface PartnerPortalData {
  affiliateName: string;
  totalsByStatus: Record<string, number>;
  rows: PartnerCommissionRow[];
}

export async function getPartnerPortalData(code: string): Promise<PartnerPortalData | null> {
  if (!isValidPartnerCode(code)) return null;
  const supabase = createAdminClient();

  // Resolve the active code → its affiliate (must also be active + not deleted).
  const { data: codeRow } = await supabase
    .from('affiliate_codes')
    .select('affiliate_id, active, affiliate:affiliates!affiliate_codes_affiliate_id_fkey (name, active, deleted_at)')
    .eq('code', code)
    .maybeSingle();
  if (!codeRow) return null;

  const row = codeRow as unknown as {
    affiliate_id: string;
    active: boolean | null;
    affiliate: { name: string; active: boolean | null; deleted_at: string | null } | null;
  };
  if (row.active === false) return null;
  const affiliate = Array.isArray(row.affiliate) ? row.affiliate[0] : row.affiliate;
  if (!affiliate || affiliate.deleted_at || affiliate.active === false) return null;

  const { data: commissionRows } = await supabase
    .from('commission_records')
    .select('id, amount_pence, status, created_at, paid_at, job:jobs!commission_records_job_id_fkey (job_number)')
    .eq('affiliate_id', row.affiliate_id)
    .order('created_at', { ascending: false })
    .limit(500);

  const raw = (commissionRows ?? []) as unknown as Array<{
    id: string;
    amount_pence: number;
    status: string;
    created_at: string;
    paid_at: string | null;
    job: { job_number: number | null } | { job_number: number | null }[] | null;
  }>;

  const rows: PartnerCommissionRow[] = raw.map((r) => {
    const job = Array.isArray(r.job) ? r.job[0] : r.job;
    return {
      id: r.id,
      amountPence: r.amount_pence,
      status: r.status,
      jobNumber: job?.job_number ?? null,
      createdAt: r.created_at,
      paidAt: r.paid_at,
    };
  });

  const totalsByStatus: Record<string, number> = {};
  for (const r of rows) totalsByStatus[r.status] = (totalsByStatus[r.status] ?? 0) + r.amountPence;

  return { affiliateName: affiliate.name, totalsByStatus, rows };
}
