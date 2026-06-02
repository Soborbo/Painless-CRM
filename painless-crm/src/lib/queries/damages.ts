import { createClient } from '@/lib/supabase/server';
import { customerDisplayName } from '@/lib/utils/format';

// Phase 11 §6 — damage-claim reads. RLS scopes to the company.

export interface DamageRow {
  id: string;
  status: 'reported' | 'investigating' | 'agreed' | 'paid' | 'denied';
  description: string;
  estimated_value_pence: number | null;
  payout_pence: number | null;
  insurance_claim_ref: string | null;
  reported_by_customer: boolean;
  repeat_claim_flag: boolean;
  auto_escalated: boolean;
  job_id: string;
  job_number: string | null;
  customer_name: string;
  created_at: string;
  version: number;
}

const SELECT =
  'id, status, description, estimated_value_pence, payout_pence, insurance_claim_ref, ' +
  'reported_by_customer, repeat_claim_flag, auto_escalated, job_id, created_at, version, ' +
  'job:jobs(job_number, customer:customers(customer_type, first_name, last_name, company_name, primary_email))';

function embed<T>(raw: unknown): T | null {
  if (Array.isArray(raw)) return (raw[0] as T) ?? null;
  return (raw as T) ?? null;
}

function toRow(raw: Record<string, unknown>): DamageRow {
  const job = embed<{ job_number: string | null; customer: unknown }>(raw.job);
  const customer = embed<Parameters<typeof customerDisplayName>[0]>(job?.customer);
  return {
    id: raw.id as string,
    status: raw.status as DamageRow['status'],
    description: raw.description as string,
    estimated_value_pence: (raw.estimated_value_pence as number | null) ?? null,
    payout_pence: (raw.payout_pence as number | null) ?? null,
    insurance_claim_ref: (raw.insurance_claim_ref as string | null) ?? null,
    reported_by_customer: Boolean(raw.reported_by_customer),
    repeat_claim_flag: Boolean(raw.repeat_claim_flag),
    auto_escalated: Boolean(raw.auto_escalated),
    job_id: raw.job_id as string,
    job_number: job?.job_number ?? null,
    customer_name: customer ? customerDisplayName(customer) : 'Unknown customer',
    created_at: raw.created_at as string,
    version: (raw.version as number) ?? 1,
  };
}

export async function listDamages(): Promise<DamageRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('damage_claims')
    .select(SELECT)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(500);
  return ((data ?? []) as unknown as Array<Record<string, unknown>>).map(toRow);
}

export async function getDamagesForJob(jobId: string): Promise<DamageRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('damage_claims')
    .select(SELECT)
    .eq('job_id', jobId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  return ((data ?? []) as unknown as Array<Record<string, unknown>>).map(toRow);
}
