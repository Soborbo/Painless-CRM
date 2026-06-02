import type { DateRange } from '@/lib/jobs/profit-dashboard';
import type { AttributionJobRow } from '@/lib/reports/attribution';
import type { ReportJobRow } from '@/lib/reports/funnel';
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
