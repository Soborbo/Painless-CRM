import { createAdminClient } from '@/lib/supabase/admin';
import { emitEvent } from './emit';

// lead.high_value_uncontacted — the daily scan behind Richard's "warm leads
// nobody called back" report. A high-value website-calculator lead that has not
// asked for a callback is one that can slip through the cracks, so each morning
// we surface them. Run inside the daily 09:00 flush, before the digest sweep, so
// the freshly-created notifications go out in the same email.
//
// "Did not request a callback": the schema has no customer-facing callback flag,
// so the only callback signal is the staff-logged phone_calls.outcome =
// 'callback_requested'. Absence of such a row = no callback requested (ADR-040).

export const DEFAULT_HIGH_VALUE_THRESHOLD_PENCE = 80000; // £800

// Early funnel stages where a high-value lead still warrants proactive chase.
const OPEN_STAGES = ['lead', 'contacted', 'survey_scheduled', 'quoted'] as const;
const SCAN_LIMIT = 1000;

export function resolveThreshold(notificationSettings: unknown): number {
  if (notificationSettings && typeof notificationSettings === 'object') {
    const raw = (notificationSettings as Record<string, unknown>).high_value_lead_threshold_pence;
    if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return Math.floor(raw);
  }
  return DEFAULT_HIGH_VALUE_THRESHOLD_PENCE;
}

export interface ScanJob {
  id: string;
  company_id: string;
  job_number: string;
  quote_total_pence: number | null;
  customerName: string;
}

export interface HighValueLead {
  jobId: string;
  companyId: string;
  jobNumber: string;
  customerName: string;
  valuePence: number;
}

// Pure selection: a job qualifies when its value clears its company's threshold,
// it has no callback-requested phone call, and it hasn't already been notified.
export function selectHighValueUncontacted(
  jobs: readonly ScanJob[],
  thresholdByCompany: ReadonlyMap<string, number>,
  callbackJobIds: ReadonlySet<string>,
  notifiedJobIds: ReadonlySet<string>,
): HighValueLead[] {
  const out: HighValueLead[] = [];
  for (const job of jobs) {
    const value = job.quote_total_pence ?? 0;
    const threshold = thresholdByCompany.get(job.company_id) ?? DEFAULT_HIGH_VALUE_THRESHOLD_PENCE;
    if (value <= threshold) continue;
    if (callbackJobIds.has(job.id)) continue;
    if (notifiedJobIds.has(job.id)) continue;
    out.push({
      jobId: job.id,
      companyId: job.company_id,
      jobNumber: job.job_number,
      customerName: job.customerName,
      valuePence: value,
    });
  }
  return out;
}

function customerName(c: { first_name: string | null; last_name: string | null; company_name: string | null } | null): string {
  if (!c) return 'Unknown customer';
  if (c.company_name) return c.company_name;
  const name = [c.first_name, c.last_name].filter(Boolean).join(' ').trim();
  return name || 'Unknown customer';
}

export interface HighValueScanResult {
  scanned: number;
  notified: number;
}

export async function scanHighValueUncontactedLeads(): Promise<HighValueScanResult> {
  const supabase = createAdminClient();

  const { data: settingsRows } = await supabase
    .from('settings')
    .select('company_id, notification_settings');
  const thresholdByCompany = new Map<string, number>();
  for (const s of (settingsRows ?? []) as Array<{ company_id: string; notification_settings: unknown }>) {
    thresholdByCompany.set(s.company_id, resolveThreshold(s.notification_settings));
  }

  const { data: jobRows } = await supabase
    .from('jobs')
    .select('id, company_id, job_number, quote_total_pence, customer:customers(first_name, last_name, company_name)')
    .eq('acquisition_source', 'website')
    .in('stage', OPEN_STAGES as unknown as string[])
    .is('deleted_at', null)
    .not('quote_total_pence', 'is', null)
    .order('quote_total_pence', { ascending: false })
    .limit(SCAN_LIMIT);

  const jobs: ScanJob[] = ((jobRows ?? []) as Array<Record<string, unknown>>).map((r) => ({
    id: r.id as string,
    company_id: r.company_id as string,
    job_number: r.job_number as string,
    quote_total_pence: (r.quote_total_pence as number | null) ?? null,
    customerName: customerName(
      (r.customer as { first_name: string | null; last_name: string | null; company_name: string | null } | null) ?? null,
    ),
  }));
  if (jobs.length === 0) return { scanned: 0, notified: 0 };

  const jobIds = jobs.map((j) => j.id);
  const [{ data: callRows }, { data: notifRows }] = await Promise.all([
    supabase.from('phone_calls').select('job_id').eq('outcome', 'callback_requested').in('job_id', jobIds),
    supabase
      .from('notifications')
      .select('related_entity_id')
      .eq('type', 'lead.high_value_uncontacted')
      .in('related_entity_id', jobIds),
  ]);
  const callbackJobIds = new Set(
    ((callRows ?? []) as Array<{ job_id: string | null }>).map((r) => r.job_id).filter((x): x is string => !!x),
  );
  const notifiedJobIds = new Set(
    ((notifRows ?? []) as Array<{ related_entity_id: string | null }>)
      .map((r) => r.related_entity_id)
      .filter((x): x is string => !!x),
  );

  const leads = selectHighValueUncontacted(jobs, thresholdByCompany, callbackJobIds, notifiedJobIds);

  for (const lead of leads) {
    await emitEvent({
      companyId: lead.companyId,
      eventKey: 'lead.high_value_uncontacted',
      title: `High-value lead £${Math.round(lead.valuePence / 100)}: ${lead.customerName} — no callback requested`,
      linkUrl: `/dashboard/jobs/${lead.jobId}`,
      relatedEntityType: 'job',
      relatedEntityId: lead.jobId,
      priority: 'high',
    });
  }

  return { scanned: jobs.length, notified: leads.length };
}
