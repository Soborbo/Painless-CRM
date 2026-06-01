import { createAdminClient } from '@/lib/supabase/admin';
import { notifyEscalation } from './notify';
import { type ComplaintStatus, isEscalationDue } from './state-machine';

// Daily complaints escalation sweep (Phase 11 §5). Any complaint still open
// (new/investigating) 7 days after creation is escalated and the company's
// managers are notified. Runs without a user → service-role client.

const MAX = 2000;

export interface ComplaintSlaResult {
  scanned: number;
  escalated: number;
}

export async function runComplaintSlaSweep(now: Date = new Date()): Promise<ComplaintSlaResult> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('complaints')
    .select('id, company_id, status, created_at, version')
    .in('status', ['new', 'investigating'])
    .is('deleted_at', null)
    .limit(MAX);

  const rows = (data ?? []) as Array<{
    id: string;
    company_id: string;
    status: ComplaintStatus;
    created_at: string;
    version: number;
  }>;

  const due = rows.filter((r) => isEscalationDue(new Date(r.created_at), r.status, now));
  const byCompany = new Map<string, number>();

  for (const row of due) {
    const { data: saved } = await supabase
      .from('complaints')
      .update({ status: 'escalated', escalated_at: now.toISOString(), version: row.version + 1 })
      .eq('id', row.id)
      .eq('version', row.version)
      .select('id')
      .maybeSingle();
    if (saved) byCompany.set(row.company_id, (byCompany.get(row.company_id) ?? 0) + 1);
  }

  for (const [companyId, count] of byCompany) {
    await notifyEscalation(companyId, count);
  }

  return { scanned: rows.length, escalated: due.length };
}
