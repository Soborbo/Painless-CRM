import { DEFAULT_DAILY_CAPACITY_HOURS } from '@/lib/capacity/band';
import { capacityWindow, dateKey } from '@/lib/capacity/calendar';
import { groupBandsByIsoWeek } from '@/lib/capacity/iso-week';
import { writeAvailability } from '@/lib/kv/availability';
import { type JobHoursRow, type OverrideRow, assembleCapacity } from '@/lib/queries/capacity';
import { createAdminClient } from '@/lib/supabase/admin';

// Nightly recompute: rebuild every company's 6-week band calendar and
// broadcast it to KV. Runs without a user (cron), so it reads with the admin
// client and scopes each query by company_id explicitly. Reuses the same pure
// assembly as the user-facing read.

export interface RecomputeResult {
  companies: number;
  published: number;
  weeks: number;
}

const MAX_JOBS = 5000;

export async function recomputeAllAvailability(now: Date = new Date()): Promise<RecomputeResult> {
  const supabase = createAdminClient();
  const window = capacityWindow(now);

  const { data: companyRows } = await supabase
    .from('companies')
    .select('id')
    .eq('status', 'active');
  const companies = (companyRows ?? []) as Array<{ id: string }>;

  const nowIso = now.toISOString();
  let published = 0;
  let weeks = 0;

  for (const company of companies) {
    const [{ data: jobRows }, { data: overrideRows }] = await Promise.all([
      supabase
        .from('jobs')
        .select('move_date, estimated_hours')
        .eq('company_id', company.id)
        .is('deleted_at', null)
        .in('stage', ['confirmed', 'in_progress'])
        .gte('move_date', window.startIso)
        .lt('move_date', window.endIso)
        .limit(MAX_JOBS),
      supabase
        .from('capacity_overrides')
        .select('date, forced_band')
        .eq('company_id', company.id)
        .gte('date', dateKey(window.startIso))
        .lt('date', dateKey(window.endIso)),
    ]);

    const days = assembleCapacity(
      (jobRows ?? []) as JobHoursRow[],
      (overrideRows ?? []) as OverrideRow[],
      window,
      DEFAULT_DAILY_CAPACITY_HOURS,
    );
    const grouped = groupBandsByIsoWeek(days.map((d) => ({ date: d.date, band: d.band })));
    const result = await writeAvailability(company.id, grouped, nowIso);
    if (result.ok) {
      published += 1;
      weeks += result.weeksWritten;
    }
  }

  return { companies: companies.length, published, weeks };
}
