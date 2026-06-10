import type { DigestManager, OverdueLeadForDigest } from '@/lib/jobs/sla-digest';
import { createAdminClient } from '@/lib/supabase/admin';
import { customerDisplayName } from '@/lib/utils/format';

// Data layer for the SLA digest cron (Phase 06b §1). Runs on the service-role
// client because the cron has no user session — RLS is bypassed, so both reads
// span every company and the pure layer regroups them per tenant.

const DIGEST_RECIPIENT_ROLES = ['manager', 'admin'] as const;
const MAX_OVERDUE_LEADS = 1000;

const OVERDUE_LEAD_COLUMNS = `
  id, job_number, company_id, acquisition_source, first_response_due_at, assigned_to_id,
  customer:customers (customer_type, first_name, last_name, company_name, primary_email),
  assigned_to:users!jobs_assigned_to_id_fkey (full_name)
`;

function embedOne<T>(raw: unknown): T | null {
  if (Array.isArray(raw)) return (raw[0] as T | undefined) ?? null;
  return (raw as T | null) ?? null;
}

export interface OverdueDigestData {
  leads: OverdueLeadForDigest[];
  managers: DigestManager[];
}

export async function fetchOverdueDigestData(now: Date): Promise<OverdueDigestData> {
  const supabase = createAdminClient();

  const [{ data: leadRows }, { data: managerRows }] = await Promise.all([
    supabase
      .from('jobs')
      .select(OVERDUE_LEAD_COLUMNS)
      .is('deleted_at', null)
      .is('first_response_at', null)
      .in('stage', ['lead', 'contacted'])
      .lt('first_response_due_at', now.toISOString())
      .order('first_response_due_at', { ascending: true })
      .limit(MAX_OVERDUE_LEADS),
    supabase
      .from('users')
      .select('company_id, email')
      .eq('active', true)
      .in('role', DIGEST_RECIPIENT_ROLES),
  ]);

  const leads: OverdueLeadForDigest[] = ((leadRows ?? []) as Array<Record<string, unknown>>).map(
    (raw) => {
      const customer = embedOne<{
        customer_type: string;
        first_name: string | null;
        last_name: string | null;
        company_name: string | null;
        primary_email: string | null;
      }>(raw.customer);
      const assigned = embedOne<{ full_name: string }>(raw.assigned_to);
      return {
        job_id: raw.id as string,
        job_number: raw.job_number as string,
        company_id: raw.company_id as string,
        acquisition_source: (raw.acquisition_source as string | null) ?? null,
        first_response_due_at: raw.first_response_due_at as string,
        customer_name: customer ? customerDisplayName(customer) : 'Unknown customer',
        assigned_to_name: assigned?.full_name ?? null,
        assigned_to_id: (raw.assigned_to_id as string | null) ?? null,
      };
    },
  );

  const managers: DigestManager[] = ((managerRows ?? []) as Array<Record<string, unknown>>)
    .map((raw) => ({
      company_id: raw.company_id as string,
      email: (raw.email as string | null) ?? '',
    }))
    .filter((m) => m.email.length > 0);

  return { leads, managers };
}

// Job IDs that already have an SLA-breach notification, for the cron's dedup
// (Phase 15). Service-role read so it spans tenants like the rest of the cron.
export async function fetchNotifiedBreachJobIds(jobIds: readonly string[]): Promise<Set<string>> {
  if (jobIds.length === 0) return new Set();
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('notifications')
    .select('related_entity_id')
    .eq('type', 'sla_breach')
    .in('related_entity_id', jobIds as string[]);
  return new Set(
    ((data ?? []) as Array<{ related_entity_id: string | null }>)
      .map((r) => r.related_entity_id)
      .filter((id): id is string => !!id),
  );
}
