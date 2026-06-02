import { createClient } from '@/lib/supabase/server';

export type CommissionRow = {
  id: string;
  amount_pence: number;
  status: string;
  approved_at: string | null;
  paid_at: string | null;
  created_at: string;
  affiliate_id: string;
  affiliate_name: string | null;
  job_number: number | null;
};

export type CommissionListResult = {
  rows: CommissionRow[];
  totalsByStatus: Record<string, number>;
};

const STATUS_FILTERS = ['pending', 'approved', 'paid', 'cancelled'] as const;

export async function listCommissions(status?: string): Promise<CommissionListResult> {
  const supabase = await createClient();
  let query = supabase
    .from('commission_records')
    .select(
      'id, amount_pence, status, approved_at, paid_at, created_at, affiliate_id, affiliate:affiliates!commission_records_affiliate_id_fkey (name), job:jobs!commission_records_job_id_fkey (job_number)',
    )
    .order('created_at', { ascending: false });
  if (status && (STATUS_FILTERS as readonly string[]).includes(status)) {
    query = query.eq('status', status);
  }

  const { data } = await query;
  const raw = (data ?? []) as unknown as Array<{
    id: string;
    amount_pence: number;
    status: string;
    approved_at: string | null;
    paid_at: string | null;
    created_at: string;
    affiliate_id: string;
    affiliate: { name: string | null } | null;
    job: { job_number: number | null } | null;
  }>;

  const rows: CommissionRow[] = raw.map((r) => ({
    id: r.id,
    amount_pence: r.amount_pence,
    status: r.status,
    approved_at: r.approved_at,
    paid_at: r.paid_at,
    created_at: r.created_at,
    affiliate_id: r.affiliate_id,
    affiliate_name: r.affiliate?.name ?? null,
    job_number: r.job?.job_number ?? null,
  }));

  const totalsByStatus: Record<string, number> = {};
  for (const r of rows) {
    totalsByStatus[r.status] = (totalsByStatus[r.status] ?? 0) + r.amount_pence;
  }
  return { rows, totalsByStatus };
}
