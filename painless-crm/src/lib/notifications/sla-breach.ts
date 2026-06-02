// Phase 15 — SLA-breach notification selection. Pure: given the overdue leads
// the sla-digest cron already fetched and the set of job IDs that have *already*
// had a breach notification, pick the leads that still need one. Dedup is by
// job ID so the daily cron never re-notifies the same breach; a lead with no
// assigned rep is skipped (nobody to notify — managers still get the email).

export interface BreachLead {
  job_id: string;
  job_number: string;
  company_id: string;
  assigned_to_id?: string | null;
}

export interface BreachNotification {
  companyId: string;
  recipientUserId: string;
  jobId: string;
  jobNumber: string;
}

export function selectBreachNotifications(
  leads: readonly BreachLead[],
  alreadyNotifiedJobIds: ReadonlySet<string>,
): BreachNotification[] {
  const out: BreachNotification[] = [];
  const seen = new Set<string>();
  for (const lead of leads) {
    if (!lead.assigned_to_id) continue;
    if (alreadyNotifiedJobIds.has(lead.job_id) || seen.has(lead.job_id)) continue;
    seen.add(lead.job_id);
    out.push({
      companyId: lead.company_id,
      recipientUserId: lead.assigned_to_id,
      jobId: lead.job_id,
      jobNumber: lead.job_number,
    });
  }
  return out;
}
