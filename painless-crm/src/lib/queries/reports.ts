import type { DateRange } from '@/lib/jobs/profit-dashboard';
import type { AnalyticsJobRow } from '@/lib/reports/analytics';
import type { AttributionJobRow } from '@/lib/reports/attribution';
import type { FinancialInvoiceRow } from '@/lib/reports/financial';
import type { ReportJobRow } from '@/lib/reports/funnel';
import type { SlaJobRow } from '@/lib/reports/sla-performance';
import { createClient } from '@/lib/supabase/server';

// Reporting v0 read. Pulls the lead cohort that *enquired* within the range
// (by enquiry_at) with just the milestone timestamps the funnel needs. RLS
// scopes it to the caller's company. Aggregation is pure (lib/reports/funnel).

const COLUMNS =
  'acquisition_source, contacted_at, quoted_at, accepted_at, paid_at, quote_total_pence';

const REPORT_ROW_CAP = 5000;

export async function listReportJobs(range: DateRange): Promise<ReportJobRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('jobs')
    .select(COLUMNS)
    .is('deleted_at', null)
    .gte('enquiry_at', range.startIso)
    .lt('enquiry_at', range.endIso)
    .limit(REPORT_ROW_CAP);
  return (data ?? []) as ReportJobRow[];
}

// Source-attribution read (Phase 14 §4/§5): same enquiry cohort plus customer_id
// so the aggregator can derive repeat rate + LTV per source.
const ATTRIBUTION_COLUMNS =
  'acquisition_source, customer_id, quoted_at, paid_at, quote_total_pence';

export async function listAttributionJobs(range: DateRange): Promise<AttributionJobRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('jobs')
    .select(ATTRIBUTION_COLUMNS)
    .is('deleted_at', null)
    .gte('enquiry_at', range.startIso)
    .lt('enquiry_at', range.endIso)
    .limit(REPORT_ROW_CAP);
  return (data ?? []) as AttributionJobRow[];
}

// Visual analytics read (Phase 21): the enquiry cohort with the columns the
// dashboard breakdowns and projected-revenue need, plus the assigned rep name.
const ANALYTICS_COLUMNS = `
  stage, service_type, acquisition_source, assigned_to_id, quoted_at, paid_at, quote_total_pence,
  assigned_to:users!jobs_assigned_to_id_fkey (full_name)
`;

export async function listAnalyticsJobs(range: DateRange): Promise<AnalyticsJobRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('jobs')
    .select(ANALYTICS_COLUMNS)
    .is('deleted_at', null)
    .gte('enquiry_at', range.startIso)
    .lt('enquiry_at', range.endIso)
    .limit(REPORT_ROW_CAP);
  return ((data ?? []) as Array<Record<string, unknown>>).map((raw) => {
    const assigned = raw.assigned_to;
    const name = Array.isArray(assigned)
      ? (assigned[0] as { full_name: string } | undefined)?.full_name
      : (assigned as { full_name: string } | null)?.full_name;
    return {
      stage: (raw.stage as string | null) ?? 'lead',
      service_type: (raw.service_type as string | null) ?? null,
      acquisition_source: (raw.acquisition_source as string | null) ?? null,
      assigned_to_id: (raw.assigned_to_id as string | null) ?? null,
      assigned_to_name: name ?? null,
      quoted_at: (raw.quoted_at as string | null) ?? null,
      paid_at: (raw.paid_at as string | null) ?? null,
      quote_total_pence: (raw.quote_total_pence as number | null) ?? null,
    } satisfies AnalyticsJobRow;
  });
}

// Financial report reads (Phase 14). RLS scopes both to the caller's company.
const FINANCIAL_COLUMNS =
  'status, total_pence, amount_paid_pence, amount_outstanding_pence, issued_at, due_at';

// Revenue-summary cohort: invoices *issued* within the range.
export async function listFinancialInvoices(range: DateRange): Promise<FinancialInvoiceRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('invoices')
    .select(FINANCIAL_COLUMNS)
    .is('deleted_at', null)
    .gte('issued_at', range.startIso)
    .lt('issued_at', range.endIso)
    .limit(REPORT_ROW_CAP);
  return (data ?? []) as FinancialInvoiceRow[];
}

// AR-aging snapshot: everything still owed *as of now*, regardless of range.
export async function listOutstandingInvoices(): Promise<FinancialInvoiceRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('invoices')
    .select(FINANCIAL_COLUMNS)
    .is('deleted_at', null)
    .gt('amount_outstanding_pence', 0)
    .in('status', ['sent', 'partial', 'overdue'])
    .limit(REPORT_ROW_CAP);
  return (data ?? []) as FinancialInvoiceRow[];
}

// SLA performance read (Phase 16 §5): the enquiry cohort's first-response
// timestamps + assigned rep, for response-time / breach analytics.
const SLA_COLUMNS = `
  enquiry_at, first_response_due_at, first_response_at, assigned_to_id,
  assigned_to:users!jobs_assigned_to_id_fkey (full_name)
`;

export async function listSlaJobs(range: DateRange): Promise<SlaJobRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('jobs')
    .select(SLA_COLUMNS)
    .is('deleted_at', null)
    .gte('enquiry_at', range.startIso)
    .lt('enquiry_at', range.endIso)
    .limit(REPORT_ROW_CAP);
  return ((data ?? []) as Array<Record<string, unknown>>).map((raw) => {
    const assigned = raw.assigned_to;
    const name = Array.isArray(assigned)
      ? (assigned[0] as { full_name: string } | undefined)?.full_name
      : (assigned as { full_name: string } | null)?.full_name;
    return {
      enquiry_at: (raw.enquiry_at as string | null) ?? null,
      first_response_due_at: (raw.first_response_due_at as string | null) ?? null,
      first_response_at: (raw.first_response_at as string | null) ?? null,
      assigned_to_id: (raw.assigned_to_id as string | null) ?? null,
      assigned_to_name: name ?? null,
    };
  });
}
