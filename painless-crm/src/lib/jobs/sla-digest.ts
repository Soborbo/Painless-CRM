// Pure composition for the 9am SLA overdue-lead email digest.
// Phase 06b §1 (v0.1 notification fallback). The cron route + query layer
// supply already-resolved rows; everything here is pure so the grouping,
// recipient matching and email text are unit-testable without Supabase or
// Resend.

export interface OverdueLeadForDigest {
  job_id: string;
  job_number: string;
  company_id: string;
  acquisition_source: string | null;
  first_response_due_at: string;
  customer_name: string;
  assigned_to_name: string | null;
  /** The assigned rep, for the in-app breach notification (Phase 15). */
  assigned_to_id?: string | null;
}

export interface DigestManager {
  company_id: string;
  email: string;
}

export interface CompanyDigest {
  companyId: string;
  recipients: string[];
  subject: string;
  text: string;
  leadCount: number;
}

// Whole minutes a deadline is past `now` (never negative — callers only pass
// already-overdue leads, but clamp defensively).
export function minutesOverdue(dueAtIso: string, now: Date): number {
  const diffMs = now.getTime() - new Date(dueAtIso).getTime();
  return Math.max(0, Math.floor(diffMs / 60_000));
}

function leadLine(lead: OverdueLeadForDigest, now: Date): string {
  const mins = minutesOverdue(lead.first_response_due_at, now);
  const rep = lead.assigned_to_name ?? 'Unassigned';
  const source = lead.acquisition_source ?? 'unknown source';
  return `• ${lead.job_number} — ${lead.customer_name} (${source}) — ${mins}m overdue — ${rep}`;
}

export function composeDigestText(leads: readonly OverdueLeadForDigest[], now: Date): string {
  const sorted = [...leads].sort(
    (a, b) =>
      new Date(a.first_response_due_at).getTime() - new Date(b.first_response_due_at).getTime(),
  );
  return [
    `${sorted.length} lead${sorted.length === 1 ? '' : 's'} are past their first-response SLA:`,
    '',
    ...sorted.map((lead) => leadLine(lead, now)),
    '',
    'Open the SLA board: /dashboard/sla',
  ].join('\n');
}

function digestSubject(count: number): string {
  return count === 1 ? '1 lead past SLA' : `${count} leads past SLA`;
}

// Groups overdue leads by company and pairs each group with that company's
// manager recipients. Companies with overdue leads but no reachable manager
// are dropped (nowhere to send); companies with no overdue leads never appear.
export function buildCompanyDigests(
  leads: readonly OverdueLeadForDigest[],
  managers: readonly DigestManager[],
  now: Date,
): CompanyDigest[] {
  const recipientsByCompany = new Map<string, string[]>();
  for (const m of managers) {
    if (!m.email) continue;
    const list = recipientsByCompany.get(m.company_id) ?? [];
    if (!list.includes(m.email)) list.push(m.email);
    recipientsByCompany.set(m.company_id, list);
  }

  const leadsByCompany = new Map<string, OverdueLeadForDigest[]>();
  for (const lead of leads) {
    const list = leadsByCompany.get(lead.company_id) ?? [];
    list.push(lead);
    leadsByCompany.set(lead.company_id, list);
  }

  const digests: CompanyDigest[] = [];
  for (const [companyId, companyLeads] of leadsByCompany) {
    const recipients = recipientsByCompany.get(companyId);
    if (!recipients || recipients.length === 0) continue;
    digests.push({
      companyId,
      recipients,
      subject: digestSubject(companyLeads.length),
      text: composeDigestText(companyLeads, now),
      leadCount: companyLeads.length,
    });
  }
  return digests;
}
