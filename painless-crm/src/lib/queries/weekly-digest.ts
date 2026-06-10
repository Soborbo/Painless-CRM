import type { KpiWindows } from '@/lib/reports/kpi';
import type {
  DigestAcceptance,
  DigestLeadJob,
  DigestManager,
  DigestQuote,
  DigestWonJob,
} from '@/lib/reports/weekly-digest';
import { createAdminClient } from '@/lib/supabase/admin';

// Data layer for the weekly performance digest cron (Phase 14). Runs on the
// service-role client — the cron has no user session, so RLS is bypassed and
// reads span every company; the pure layer regroups per tenant. Each query
// covers the whole fortnight (previous window start → current window end) so a
// single fetch feeds both the current and prior-week counts.

const DIGEST_RECIPIENT_ROLES = ['manager', 'admin'] as const;
const MAX_ROWS = 5000;

export interface WeeklyDigestData {
  leadJobs: DigestLeadJob[];
  wonJobs: DigestWonJob[];
  quotes: DigestQuote[];
  acceptances: DigestAcceptance[];
  managers: DigestManager[];
}

export async function fetchWeeklyDigestData(windows: KpiWindows): Promise<WeeklyDigestData> {
  const supabase = createAdminClient();
  const spanStart = windows.previous.startIso;
  const spanEnd = windows.current.endIso;

  const [leads, won, quotes, acceptances, managers] = await Promise.all([
    supabase
      .from('jobs')
      .select('company_id, enquiry_at')
      .is('deleted_at', null)
      .gte('enquiry_at', spanStart)
      .lt('enquiry_at', spanEnd)
      .limit(MAX_ROWS),
    supabase
      .from('jobs')
      .select('company_id, paid_at, quote_total_pence')
      .is('deleted_at', null)
      .gte('paid_at', spanStart)
      .lt('paid_at', spanEnd)
      .limit(MAX_ROWS),
    supabase
      .from('quotes')
      .select('company_id, sent_at')
      .is('deleted_at', null)
      .gte('sent_at', spanStart)
      .lt('sent_at', spanEnd)
      .limit(MAX_ROWS),
    supabase
      .from('quote_acceptances')
      .select('company_id, accepted_at')
      .gte('accepted_at', spanStart)
      .lt('accepted_at', spanEnd)
      .limit(MAX_ROWS),
    supabase
      .from('users')
      .select('company_id, email')
      .eq('active', true)
      .in('role', DIGEST_RECIPIENT_ROLES),
  ]);

  const managerList: DigestManager[] = ((managers.data ?? []) as Array<Record<string, unknown>>)
    .map((raw) => ({
      company_id: raw.company_id as string,
      email: (raw.email as string | null) ?? '',
    }))
    .filter((m) => m.email.length > 0);

  return {
    leadJobs: (leads.data ?? []) as DigestLeadJob[],
    wonJobs: (won.data ?? []) as DigestWonJob[],
    quotes: (quotes.data ?? []) as DigestQuote[],
    acceptances: (acceptances.data ?? []) as DigestAcceptance[],
    managers: managerList,
  };
}
