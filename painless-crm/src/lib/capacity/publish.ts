import { capacityWindow } from '@/lib/capacity/calendar';
import { groupBandsByIsoWeek } from '@/lib/capacity/iso-week';
import { type WriteAvailabilityResult, writeAvailability } from '@/lib/kv/availability';
import { getCapacityCalendar } from '@/lib/queries/capacity';

// Recompute the 6-week band calendar and broadcast it to KV. Called after an
// override changes (and, later, by the nightly cron). Only bands are
// published. Returns the write result so cron can log coverage; the override
// actions call it best-effort and ignore the outcome.
export async function publishAvailability(companyId: string): Promise<WriteAvailabilityResult> {
  const window = capacityWindow(new Date());
  const days = await getCapacityCalendar(window);
  const weeks = groupBandsByIsoWeek(days.map((d) => ({ date: d.date, band: d.band })));
  return writeAvailability(companyId, weeks, new Date().toISOString());
}
